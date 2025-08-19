import { getCachedWeather, setCachedWeather } from './cache'
import { logEvent } from './logger'

const BASE = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'

export async function fetchWeatherForPoint(apiKey, lat, lon, dateIso) {
  const hasTime = typeof dateIso === 'string' && dateIso.includes('T')
  const dayPart = hasTime ? dateIso.slice(0, 10) : dateIso
  const cacheKeyIso = hasTime ? dayPart : dateIso

  const cached = await getCachedWeather(lat, lon, cacheKeyIso)
  if (cached) return cached

  const include = hasTime ? 'hours' : 'current'
  const url = `${BASE}/${lat},${lon}/${dayPart}?unitGroup=metric&key=${encodeURIComponent(apiKey)}&include=${include}`

  const startedAt = Date.now()
  const res = await fetch(url)
  const durationMs = Date.now() - startedAt
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`)
  const data = await res.json()
  await setCachedWeather(lat, lon, cacheKeyIso, data)

  try {
    logEvent({
      type: 'weather:fetch',
      url,
      status: res.status,
      durationMs,
      point: { lat, lon },
      dateIso,
      summary: {
        windspeed: data?.days?.[0]?.windspeed ?? data?.currentConditions?.windspeed,
        winddir: data?.days?.[0]?.winddir ?? data?.currentConditions?.winddir,
        temp: data?.days?.[0]?.temp ?? data?.currentConditions?.temp,
        humidity: data?.days?.[0]?.humidity ?? data?.currentConditions?.humidity,
        visibility: data?.days?.[0]?.visibility ?? data?.currentConditions?.visibility,
      },
    })
  } catch {
    // Ignore logging failures
  }

  return data
}

export async function fetchAggregatedForRoute(apiKey, points, dateIso) {
  const hasTime = typeof dateIso === 'string' && dateIso.includes('T')
  const targetEpochMs = hasTime ? new Date(dateIso).getTime() : null

  const results = []
  for (const { lat, lon } of points) {
    const data = await fetchWeatherForPoint(apiKey, lat, lon, dateIso)
    let source = null

    if (hasTime) {
      const hours = data?.days?.[0]?.hours || []
      if (hours.length) {
        let best = hours[0]
        let bestDiff = Math.abs((best.datetimeEpoch || 0) * 1000 - targetEpochMs)
        for (let i = 1; i < hours.length; i++) {
          const h = hours[i]
          const diff = Math.abs((h.datetimeEpoch || 0) * 1000 - targetEpochMs)
          if (diff < bestDiff) {
            best = h
            bestDiff = diff
          }
        }
        source = best
      }
    }

    if (!source) {
      source = data?.days?.[0] || data?.currentConditions || {}
    }

    results.push({
      lat,
      lon,
      windSpeed: Number(source.windspeed || source.windSpeed || 0),
      windDirection: Number(source.winddir || source.windDirection || 0),
      tempC: Number(source.temp || source.tempC || 0),
      humidity: Number(source.humidity || 0),
      visibilityKm: Number(source.visibility || 0),
    })
  }

  if (results.length === 0) return null

  const avg = (key) => results.reduce((s, r) => s + (Number(r[key]) || 0), 0) / results.length
  const aggregated = {
    windSpeed: avg('windSpeed'),
    windDirection: avg('windDirection'),
    tempC: avg('tempC'),
    humidity: avg('humidity'),
    visibilityKm: avg('visibilityKm'),
    byPoint: results,
  }
  try {
    logEvent({ type: 'weather:aggregate', dateIso, points: points.length, aggregated })
  } catch {
    // Ignore logging failures
  }
  return aggregated
}


