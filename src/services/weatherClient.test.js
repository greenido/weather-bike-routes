import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conditionsAt, fetchForecasts, fromOpenMeteo, fromVisualCrossing } from './weatherClient'

// In-memory stand-in for the IndexedDB forecast cache (Node has no IndexedDB).
const memoryCache = vi.hoisted(() => new Map())
vi.mock('./cache', () => ({
  getCachedForecast: async (key) => memoryCache.get(key),
  setCachedForecast: async (key, data) => {
    memoryCache.set(key, data)
  },
}))

const HOUR = 3600 * 1000
const T0 = Date.UTC(2026, 8, 12, 6)

const series = (overrides = {}) => ({
  times: [T0, T0 + HOUR, T0 + 2 * HOUR],
  tempC: [10, 20, 30],
  feelsLikeC: [8, 18, 28],
  rainChance: [0, 40, 80],
  precipMm: [0, 0.2, 1],
  windKph: [10, 10, 10],
  windFromDeg: [350, 10, 10],
  gustKph: [15, 20, 25],
  visibilityKm: [20, 20, 20],
  ...overrides,
})

describe('conditionsAt', () => {
  it('interpolates between the surrounding hours', () => {
    const c = conditionsAt(series(), T0 + HOUR / 2)
    expect(c.tempC).toBeCloseTo(15)
    expect(c.feelsLikeC).toBeCloseTo(13)
    expect(c.rainChance).toBeCloseTo(20)
  })

  it('blends wind directions as vectors, so 350° and 10° meet at north', () => {
    const c = conditionsAt(series(), T0 + HOUR / 2)
    expect(Math.min(c.windFromDeg, 360 - c.windFromDeg)).toBeLessThan(0.01)
    expect(c.windKph).toBeCloseTo(9.85, 1)
  })

  it('clamps to the first and last hour outside the series', () => {
    expect(conditionsAt(series(), T0 - HOUR).tempC).toBe(10)
    expect(conditionsAt(series(), T0 + 5 * HOUR).tempC).toBe(30)
  })

  it('fills gaps in optional fields', () => {
    const nulls = [null, null, null]
    const c = conditionsAt(series({ feelsLikeC: nulls, rainChance: nulls, visibilityKm: nulls, gustKph: nulls }), T0 + 2 * HOUR)
    expect(c.feelsLikeC).toBe(30)
    expect(c.rainChance).toBe(50)
    expect(c.visibilityKm).toBe(20)
    expect(c.gustKph).toBeCloseTo(c.windKph)
  })

  it('refuses a forecast without temperatures', () => {
    expect(() => conditionsAt(series({ tempC: [null, null, null] }), T0)).toThrow('missing temperatures')
  })
})

describe('response normalizers', () => {
  it('reads Open-Meteo hourly columns and converts units', () => {
    const s = fromOpenMeteo({
      hourly: {
        time: [T0 / 1000], temperature_2m: [12], apparent_temperature: [11], precipitation_probability: [5], precipitation: [0],
        wind_speed_10m: [14], wind_direction_10m: [270], wind_gusts_10m: [30], visibility: [24000],
      },
    })
    expect(s).toMatchObject({ times: [T0], tempC: [12], feelsLikeC: [11], windFromDeg: [270], visibilityKm: [24] })
  })

  it('flattens Visual Crossing days into one sorted hourly series', () => {
    const hour = (epochSec, temp) => ({ datetimeEpoch: epochSec, temp, feelslike: temp, precipprob: 0, precip: 0, windspeed: 5, winddir: 90, windgust: 9, visibility: 15 })
    const s = fromVisualCrossing({ days: [{ hours: [hour(T0 / 1000 + 3600, 13)] }, { hours: [hour(T0 / 1000, 12)] }] })
    expect(s.times).toEqual([T0, T0 + HOUR])
    expect(s.tempC).toEqual([12, 13])
    expect(s.visibilityKm).toEqual([15, 15])
  })
})

describe('fetchForecasts', () => {
  const start = Date.now() + 24 * HOUR
  const end = start + 3 * HOUR
  const points = [{ lat: 45.12345, lon: 7.00001 }, { lat: 45.2, lon: 7.1 }, { lat: 45.12345, lon: 7.00001 }]
  const openMeteoLocation = (temp) => ({
    hourly: {
      time: [start / 1000], temperature_2m: [temp], apparent_temperature: [temp], precipitation_probability: [0], precipitation: [0],
      wind_speed_10m: [5], wind_direction_10m: [0], wind_gusts_10m: [8], visibility: [20000],
    },
  })
  const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) })
  const textResponse = (body, status) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body })
  const visualCrossingBody = { queryCost: 1, days: [{ hours: [0, 1, 2, 3].map((h) => ({ datetimeEpoch: start / 1000 + h * 3600, temp: 9 })) }] }
  const tooManyAtOnce = () => textResponse('Maximum concurrency exceeded', 429)
  const dailyCostExceeded = () => textResponse('Maximum daily cost exceeded', 429)

  beforeEach(() => {
    memoryCache.clear()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('asks Open-Meteo for every distinct point in a single request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([openMeteoLocation(11), openMeteoLocation(12)]))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchForecasts(points, start, end)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('45.123,45.2')
    expect(url.searchParams.get('longitude')).toBe('7,7.1')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    expect(result.map((s) => s.tempC[0])).toEqual([11, 12, 11])
  })

  it('uses Visual Crossing, one request per point, when an API key is set', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(visualCrossingBody))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchForecasts(points.slice(0, 2), start, end, { apiKey: 'test-key' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const url = new URL(fetchMock.mock.calls[0][0])
    // No dates: the plain forecast costs one record, while a range reaching into the past is billed per hour.
    expect(url.pathname).toMatch(/\/timeline\/45\.12,7$/)
    expect(url.searchParams.get('elements')).toContain('datetimeEpoch')
    expect(url.searchParams.get('key')).toBe('test-key')
    expect(result.map((s) => s.tempC[0])).toEqual([9, 9])
  })

  it('reuses a Visual Crossing forecast for a new start time, and shares it between nearby points', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(visualCrossingBody))
    vi.stubGlobal('fetch', fetchMock)
    const nearby = [{ lat: 45.501, lon: 7.501 }, { lat: 45.503, lon: 7.498 }]
    await fetchForecasts(nearby, start, end, { apiKey: 'test-key' })
    await fetchForecasts(nearby, start - HOUR, end - HOUR, { apiKey: 'test-key' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("says so when the forecast doesn't reach the end of the ride", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(visualCrossingBody)))
    await expect(fetchForecasts(points.slice(0, 1), start, end + 5 * HOUR, { apiKey: 'test-key' }))
      .rejects.toThrow("The Visual Crossing forecast doesn't reach the end of this ride yet")
  })

  it('serves repeat requests from the cache', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([openMeteoLocation(11), openMeteoLocation(12)]))
    vi.stubGlobal('fetch', fetchMock)
    await fetchForecasts(points, start, end)
    const again = await fetchForecasts(points, start, end)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(again.map((s) => s.tempC[0])).toEqual([11, 12, 11])
  })

  it('sends Visual Crossing requests one at a time, even for several routes at once', async () => {
    let active = 0
    let maxActive = 0
    const fetchMock = vi.fn(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return jsonResponse(visualCrossingBody)
    })
    vi.stubGlobal('fetch', fetchMock)
    const home = { lat: 45.5, lon: 7.5 }
    const routes = await Promise.all([
      fetchForecasts([home, { lat: 45.6, lon: 7.6 }], start, end, { apiKey: 'test-key' }),
      fetchForecasts([home, { lat: 45.7, lon: 7.7 }], start, end, { apiKey: 'test-key' }),
    ])
    expect(maxActive).toBe(1)
    // The shared start is fetched once: the second route finds it in the cache when its turn comes.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(routes.flat().map((s) => s.tempC[0])).toEqual([9, 9, 9, 9])
  })

  it('retries a Visual Crossing 429 after a pause', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValueOnce(tooManyAtOnce()).mockResolvedValue(jsonResponse(visualCrossingBody))
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchForecasts(points.slice(0, 1), start, end, { apiKey: 'test-key' })
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after two retries with a plain message, and drops the rest of the route', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (url, { signal }) => {
      signal.throwIfAborted()
      return tooManyAtOnce()
    })
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchForecasts(points.slice(0, 2), start, end, { apiKey: 'test-key' })
    const failure = expect(pending).rejects.toMatchObject({
      message: 'Visual Crossing is limiting requests right now: Maximum concurrency exceeded. Wait a minute and try again, or clear the key in Settings to use Open-Meteo.',
    })
    await vi.advanceTimersByTimeAsync(7000)
    await failure
    // The first point was tried three times; the second point was never requested.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('falls back to Open-Meteo at a spent daily allowance, and leaves Visual Crossing alone for an hour', async () => {
    // Two hours in the past, so the pause has run out by the time the other tests run.
    vi.useFakeTimers({ now: Date.now() - 2 * HOUR })
    const fetchMock = vi.fn(async (url) => (url.includes('visualcrossing.com')
      ? dailyCostExceeded()
      : jsonResponse([openMeteoLocation(11), openMeteoLocation(12)].slice(0, new URL(url).searchParams.get('latitude').split(',').length))))
    vi.stubGlobal('fetch', fetchMock)
    const hosts = () => fetchMock.mock.calls.map(([url]) => new URL(url).host)
    const onFallback = vi.fn()
    const routes = await Promise.all([
      fetchForecasts(points.slice(0, 2), start, end, { apiKey: 'test-key', onFallback }),
      fetchForecasts([{ lat: 46, lon: 8 }], start, end, { apiKey: 'test-key', onFallback }),
    ])
    expect(routes.flat().map((s) => s.tempC[0])).toEqual([11, 12, 11])
    // One refused request, never retried; the second route didn't ask Visual Crossing at all.
    expect(hosts()).toEqual(['weather.visualcrossing.com', 'api.open-meteo.com', 'api.open-meteo.com'])
    expect(onFallback).toHaveBeenCalledTimes(2)
    expect(onFallback.mock.calls[0][0]).toMatch(/^Visual Crossing's daily allowance for this API key is used up \(Maximum daily cost exceeded\), so these forecasts come from Open-Meteo\. The app asks Visual Crossing again after /)

    vi.setSystemTime(Date.now() + HOUR)
    await fetchForecasts([{ lat: 47, lon: 9 }], start, end, { apiKey: 'test-key' })
    expect(hosts().filter((host) => host === 'weather.visualcrossing.com')).toHaveLength(2)
  })

  it('stops waiting to retry when the ride is cancelled', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => tooManyAtOnce())
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const pending = fetchForecasts(points.slice(0, 1), start, end, { apiKey: 'test-key', signal: controller.signal })
    const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(500)
    controller.abort()
    await cancelled
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('explains Open-Meteo rate limits without retrying', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: true, reason: 'Minutely API request limit exceeded. Please try again in one minute.' }, 429))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchForecasts(points, start, end)).rejects.toMatchObject({
      message: 'Open-Meteo is limiting requests right now: Minutely API request limit exceeded. Please try again in one minute.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never logs request URLs, which would expose the API key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ days: [] })))
    await fetchForecasts(points.slice(0, 1), start, end, { apiKey: 'secret-key' })
    const logged = JSON.stringify(console.info.mock.calls)
    expect(logged).toContain('weather:fetch')
    expect(logged).not.toContain('secret-key')
  })

  it('surfaces the provider error reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: true, reason: "Parameter 'start_date' is out of allowed range" }, 400)))
    await expect(fetchForecasts(points, start, end)).rejects.toThrow("Open-Meteo request failed (400): Parameter 'start_date' is out of allowed range")
  })

  it('explains network failures in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(fetchForecasts(points, start, end)).rejects.toThrow("Couldn't reach Open-Meteo")
  })

  it('lets cancellations through untouched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Aborted', 'AbortError') }))
    await expect(fetchForecasts(points, start, end)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects rides beyond the forecast horizon without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const farAway = Date.now() + 20 * 24 * HOUR
    await expect(fetchForecasts(points, farAway, farAway + HOUR)).rejects.toThrow('Forecasts only reach 15 days ahead')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
