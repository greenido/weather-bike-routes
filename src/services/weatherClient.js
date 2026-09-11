/*
  File: src/services/weatherClient.js
  Purpose: Fetch hourly forecasts for the points sampled along a route, from Open-Meteo (default) or Visual Crossing.
  What it does:
  - fetchForecasts(points, startMs, endMs, { apiKey, signal }): one normalized hourly series per point, covering the
    ride. Open-Meteo needs no key and answers for all points in one request. When a Visual Crossing API key is set,
    Visual Crossing is used instead: one request per point, one at a time across the whole app, because plans cap
    how many requests an account can run at once. A 429 from it is retried twice, 2 and 5 seconds apart.
  - conditionsAt(series, ms): conditions at an exact moment, interpolated between the surrounding hours
    (wind is interpolated as a vector so 350° and 10° blend to 0°, not 180°).
  - Series are cached in IndexedDB for a couple of hours (see cache.js); requests can be cancelled with an AbortSignal.
  Normalized series: { times, tempC, feelsLikeC, rainChance, precipMm, windKph, windFromDeg, gustKph, visibilityKm }
  as parallel arrays, one entry per hour (times in epoch ms).
  Notes:
  - Request URLs are never logged: the Visual Crossing URL carries the API key.
*/
import { getCachedForecast, setCachedForecast } from './cache'
import { logEvent } from './logger'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const VISUAL_CROSSING_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
const OPEN_METEO_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'visibility',
]
export const MAX_DAYS_AHEAD = 15
const VISUAL_CROSSING_CONCURRENCY = 1
// Visual Crossing allows retrying a 429 once other requests finish, but not aggressive retry loops.
const VISUAL_CROSSING_RETRY_DELAYS_MS = [2000, 5000]
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const CLEAR_VISIBILITY_KM = 20

const round3 = (value) => Math.round(value * 1000) / 1000
const utcDate = (ms) => new Date(ms).toISOString().slice(0, 10)
const toRad = (deg) => (deg * Math.PI) / 180

// Every route loads at the same time, so all Visual Crossing requests share one queue.
const visualCrossingQueue = createQueue(VISUAL_CROSSING_CONCURRENCY)

export async function fetchForecasts(points, startMs, endMs, { apiKey = '', signal } = {}) {
  const provider = apiKey ? 'Visual Crossing' : 'Open-Meteo'
  const startDate = utcDate(startMs - HOUR_MS)
  const endDate = utcDate(endMs + HOUR_MS)
  if (endDate > utcDate(Date.now() + MAX_DAYS_AHEAD * DAY_MS)) {
    throw new Error(`Forecasts only reach ${MAX_DAYS_AHEAD} days ahead. Pick an earlier start time.`)
  }

  const coords = points.map((p) => ({ lat: round3(p.lat), lon: round3(p.lon) }))
  const keys = coords.map((c) => `${provider}:${c.lat},${c.lon}:${startDate}:${endDate}`)
  const cached = await Promise.all(keys.map(getCachedForecast))

  const pending = new Map()
  cached.forEach((series, i) => {
    if (!series && !pending.has(keys[i])) pending.set(keys[i], coords[i])
  })
  const fetched = new Map()
  if (pending.size) {
    const entries = [...pending]
    const results = apiKey
      ? await fetchVisualCrossingPoints(entries, apiKey, startDate, endDate, signal)
      : await fetchOpenMeteo(entries.map(([, coord]) => coord), startDate, endDate, signal)
    entries.forEach(([key], n) => {
      fetched.set(key, results[n])
      if (!apiKey) setCachedForecast(key, results[n])
    })
  }
  return cached.map((series, i) => series || fetched.get(keys[i]))
}

// Queues one request per point and caches each result as it arrives. If one point fails, the route fails, so the
// rest of its queued requests are dropped instead of spent.
async function fetchVisualCrossingPoints(entries, apiKey, startDate, endDate, signal) {
  const batch = new AbortController()
  const forwardAbort = () => batch.abort(signal.reason)
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })
  try {
    return await Promise.all(entries.map(([key, coord]) => visualCrossingQueue(async () => {
      batch.signal.throwIfAborted()
      // Another route may have fetched this point while the request waited in the queue (a shared start, say).
      const cached = await getCachedForecast(key)
      if (cached) return cached
      const series = await fetchVisualCrossing(apiKey, coord, startDate, endDate, batch.signal)
      await setCachedForecast(key, series)
      return series
    })))
  } catch (err) {
    batch.abort()
    throw err
  } finally {
    signal?.removeEventListener('abort', forwardAbort)
  }
}

async function fetchOpenMeteo(coords, startDate, endDate, signal) {
  const params = new URLSearchParams({
    latitude: coords.map((c) => c.lat).join(','),
    longitude: coords.map((c) => c.lon).join(','),
    hourly: OPEN_METEO_FIELDS.join(','),
    start_date: startDate,
    end_date: endDate,
    timezone: 'GMT',
    timeformat: 'unixtime',
  })
  const json = await requestJson(`${OPEN_METEO_URL}?${params}`, 'Open-Meteo', signal)
  const locations = Array.isArray(json) ? json : [json]
  if (locations.length !== coords.length) throw new Error('Open-Meteo returned an incomplete forecast. Try again.')
  return locations.map(fromOpenMeteo)
}

async function fetchVisualCrossing(apiKey, coord, startDate, endDate, signal) {
  const from = Date.parse(`${startDate}T00:00:00Z`) / 1000
  const to = Date.parse(`${endDate}T23:59:59Z`) / 1000
  const params = new URLSearchParams({ unitGroup: 'metric', include: 'hours', key: apiKey })
  const url = `${VISUAL_CROSSING_URL}/${coord.lat},${coord.lon}/${from}/${to}?${params}`
  const json = await requestJson(url, 'Visual Crossing', signal, VISUAL_CROSSING_RETRY_DELAYS_MS)
  return fromVisualCrossing(json)
}

// A 429 is retried after each delay in `retryDelaysMs` (none by default), then reported in plain words.
async function requestJson(url, provider, signal, retryDelaysMs = []) {
  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now()
    let res
    try {
      res = await fetch(url, { signal })
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      throw new Error(`Couldn't reach ${provider}. Check your connection and try again.`)
    }
    logEvent({ type: 'weather:fetch', provider, status: res.status, durationMs: Date.now() - startedAt })
    if (res.ok) return res.json()
    const reason = await errorReason(res)
    if (res.status !== 429) throw new Error(`${provider} request failed (${res.status})${reason ? `: ${reason}` : ''}`)
    if (attempt >= retryDelaysMs.length) throw new Error(tooManyRequestsMessage(provider, reason))
    await wait(retryDelaysMs[attempt], signal)
  }
}

async function errorReason(res) {
  const body = await res.text().catch(() => '')
  let reason = body
  try {
    reason = JSON.parse(body).reason || body
  } catch {
    // Visual Crossing answers errors in plain text.
  }
  return String(reason).slice(0, 200)
}

function tooManyRequestsMessage(provider, reason) {
  const detail = reason.trim()
  const parts = [`${provider} is limiting requests right now${detail ? `: ${detail.replace(/\.?$/, '.')}` : '.'}`]
  if (provider === 'Visual Crossing') parts.push('Wait a minute and try again, or clear the key in Settings to use Open-Meteo.')
  else if (!detail) parts.push('Wait a minute and try again.') // Open-Meteo's reason already says when to retry.
  return parts.join(' ')
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function fromOpenMeteo(location) {
  const hourly = location.hourly || {}
  const column = (name) => hourly[name] || []
  return {
    times: column('time').map((t) => t * 1000),
    tempC: column('temperature_2m'),
    feelsLikeC: column('apparent_temperature'),
    rainChance: column('precipitation_probability'),
    precipMm: column('precipitation'),
    windKph: column('wind_speed_10m'),
    windFromDeg: column('wind_direction_10m'),
    gustKph: column('wind_gusts_10m'),
    visibilityKm: column('visibility').map((m) => (m == null ? null : m / 1000)),
  }
}

export function fromVisualCrossing(json) {
  const hours = (json.days || []).flatMap((day) => day.hours || []).sort((a, b) => a.datetimeEpoch - b.datetimeEpoch)
  const column = (name) => hours.map((h) => h[name] ?? null)
  return {
    times: hours.map((h) => h.datetimeEpoch * 1000),
    tempC: column('temp'),
    feelsLikeC: column('feelslike'),
    rainChance: column('precipprob'),
    precipMm: column('precip'),
    windKph: column('windspeed'),
    windFromDeg: column('winddir'),
    gustKph: column('windgust'),
    visibilityKm: column('visibility'),
  }
}

export function conditionsAt(series, ms) {
  const { times } = series
  if (!times.length) throw new Error('The forecast has no hourly data for this ride.')
  let hi = times.findIndex((t) => t >= ms)
  if (hi === -1) hi = times.length - 1
  const lo = Math.max(0, hi - 1)
  const w = times[hi] > times[lo] ? Math.min(1, Math.max(0, (ms - times[lo]) / (times[hi] - times[lo]))) : 0
  const pick = (name) => {
    const a = series[name][lo]
    const b = series[name][hi]
    if (a == null) return b ?? null
    if (b == null) return a
    return a + (b - a) * w
  }

  const tempC = pick('tempC')
  if (tempC == null) throw new Error('The forecast is missing temperatures for this ride.')
  const windVector = (i) => {
    const speed = series.windKph[i] ?? 0
    const from = toRad(series.windFromDeg[i] ?? 0)
    return [speed * Math.sin(from), speed * Math.cos(from)]
  }
  const [ax, ay] = windVector(lo)
  const [bx, by] = windVector(hi)
  const x = ax + (bx - ax) * w
  const y = ay + (by - ay) * w
  const windKph = Math.hypot(x, y)
  const precipMm = pick('precipMm') ?? 0
  return {
    tempC,
    feelsLikeC: pick('feelsLikeC') ?? tempC,
    // Some models have no rain probability; fall back to "is any rain forecast at all".
    rainChance: pick('rainChance') ?? (precipMm >= 0.1 ? 50 : 0),
    precipMm,
    windKph,
    windFromDeg: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360,
    gustKph: Math.max(pick('gustKph') ?? 0, windKph),
    visibilityKm: pick('visibilityKm') ?? CLEAR_VISIBILITY_KM,
  }
}

// Runs queued tasks (functions returning promises) at most `limit` at a time, in the order they were queued.
function createQueue(limit) {
  let active = 0
  const waiting = []
  function next() {
    while (active < limit && waiting.length) {
      const { task, resolve, reject } = waiting.shift()
      active++
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        active--
        next()
      })
    }
  }
  return (task) => new Promise((resolve, reject) => {
    waiting.push({ task, resolve, reject })
    next()
  })
}
