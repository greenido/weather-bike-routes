/*
  File: src/services/routeAnalysis.js
  Purpose: Turn a parsed route, a start time, and an average speed into "what this ride will be like".
  What it does:
  - estimateArrivalTimes(points, startMs, speedKph): when you reach each point (slower uphill, faster downhill).
  - buildRouteTimeline(points, sampleIdx, conditions, etas): weather at every point, interpolated by distance
    between the sampled forecasts, with temperatures adjusted for elevation (−0.65°C per 100 m of climb).
  - summarizeRide(timeline): distance-weighted wind (with the headwind part computed per road segment),
    feels-like temperatures, rain, visibility, extremes, and comfort share — the inputs for scoring and the UI.
  - rideAdvice(timeline, summary, formatTime): short "what to wear or bring" hints.
  - analyzeRoute(route, options): the whole pipeline for one route (forecast fetch → timeline → score).
*/
import { bearingDeg } from './geo'
import { calculateRouteScore } from './scoringEngine'
import { COMFORT_MAX_C, COMFORT_MIN_C } from './temperatureScale'
import { conditionsAt, fetchForecasts } from './weatherClient'

const LAPSE_RATE_C_PER_M = 0.0065
const LEG_KM = 0.25
const HOUR_MS = 60 * 60 * 1000
const HOT_C = 25
const RAINY_CHANCE = 30
const SCORE_SAMPLES = 100

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))
const lerp = (a, b, w) => a + (b - a) * w
const toRad = (deg) => (deg * Math.PI) / 180
const windVector = (p) => [p.windKph * Math.sin(toRad(p.windFromDeg)), p.windKph * Math.cos(toRad(p.windFromDeg))]

export function estimateArrivalTimes(points, startMs, speedKph) {
  const etas = [startMs]
  let legStart = 0
  let legStartMs = startMs
  for (let i = 1; i < points.length; i++) {
    const legKm = points[i].km - points[legStart].km
    if (legKm < LEG_KM && i < points.length - 1) continue
    // Grade over a ~250 m leg: long enough to ignore GPS elevation noise.
    const rise = Number.isFinite(points[i].ele) && Number.isFinite(points[legStart].ele) ? points[i].ele - points[legStart].ele : 0
    const grade = legKm > 0 ? rise / (legKm * 1000) : 0
    const legMs = (legKm / (speedKph * clamp(1 - 6 * grade, 0.45, 1.5))) * HOUR_MS
    for (let j = legStart + 1; j <= i; j++) {
      etas[j] = legStartMs + (legKm > 0 ? (legMs * (points[j].km - points[legStart].km)) / legKm : 0)
    }
    legStart = i
    legStartMs += legMs
  }
  return etas
}

export function buildRouteTimeline(points, sampleIdx, conditions, etas) {
  let j = 0
  return points.map((p, i) => {
    while (j < sampleIdx.length - 2 && sampleIdx[j + 1] <= i) j++
    const a = points[sampleIdx[j]]
    const b = points[sampleIdx[j + 1]]
    const ca = conditions[j]
    const cb = conditions[j + 1]
    const w = b.km > a.km ? clamp((p.km - a.km) / (b.km - a.km), 0, 1) : 0
    const hasEle = [a.ele, b.ele, p.ele].every(Number.isFinite)
    // Interpolate "sea-level" temperatures, then re-apply this point's elevation (a summit between samples is colder).
    const atElevation = (key) => (hasEle
      ? lerp(ca[key] + LAPSE_RATE_C_PER_M * a.ele, cb[key] + LAPSE_RATE_C_PER_M * b.ele, w) - LAPSE_RATE_C_PER_M * p.ele
      : lerp(ca[key], cb[key], w))
    const [ax, ay] = windVector(ca)
    const [bx, by] = windVector(cb)
    const x = lerp(ax, bx, w)
    const y = lerp(ay, by, w)
    return {
      lat: p.lat,
      lon: p.lon,
      km: p.km,
      ele: p.ele,
      eta: etas[i],
      tempC: atElevation('tempC'),
      feelsLikeC: atElevation('feelsLikeC'),
      windKph: Math.hypot(x, y),
      windFromDeg: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360,
      gustKph: lerp(ca.gustKph, cb.gustKph, w),
      rainChance: lerp(ca.rainChance, cb.rainChance, w),
      visibilityKm: lerp(ca.visibilityKm, cb.visibilityKm, w),
    }
  })
}

export function summarizeRide(timeline) {
  let distanceKm = 0
  let windSum = 0
  let headwindSum = 0
  let visibilitySum = 0
  let comfortKm = 0
  let coldestIndex = 0
  let warmestIndex = 0
  let rainIndex = 0
  let maxGustKph = 0
  timeline.forEach((p, i) => {
    if (p.tempC < timeline[coldestIndex].tempC) coldestIndex = i
    if (p.tempC > timeline[warmestIndex].tempC) warmestIndex = i
    if (p.rainChance > timeline[rainIndex].rainChance) rainIndex = i
    maxGustKph = Math.max(maxGustKph, p.gustKph)
    if (i === 0) return
    const prev = timeline[i - 1]
    const d = p.km - prev.km
    if (d <= 0) return
    // Headwind = the part of the wind blowing against this segment's direction of travel.
    const heading = toRad(bearingDeg(prev, p))
    const [px, py] = windVector(prev)
    const [cx, cy] = windVector(p)
    distanceKm += d
    windSum += ((prev.windKph + p.windKph) / 2) * d
    headwindSum += (((px + cx) / 2) * Math.sin(heading) + ((py + cy) / 2) * Math.cos(heading)) * d
    visibilitySum += ((prev.visibilityKm + p.visibilityKm) / 2) * d
    const midTemp = (prev.tempC + p.tempC) / 2
    if (midTemp >= COMFORT_MIN_C && midTemp < COMFORT_MAX_C) comfortKm += d
  })
  const km = distanceKm || 1
  return {
    distanceKm,
    startMs: timeline[0].eta,
    endMs: timeline.at(-1).eta,
    avgWindKph: windSum / km,
    avgHeadwindKph: headwindSum / km,
    maxGustKph,
    feelsLikeC: resampleByDistance(timeline, 'feelsLikeC', SCORE_SAMPLES),
    maxRainChance: timeline[rainIndex].rainChance,
    rainIndex,
    avgVisibilityKm: distanceKm ? visibilitySum / km : timeline[0].visibilityKm,
    coldestIndex,
    warmestIndex,
    comfortShare: comfortKm / km,
  }
}

// Values at evenly spaced distances, so every km counts the same no matter how dense the GPX points are.
function resampleByDistance(timeline, key, count) {
  const first = timeline[0].km
  const total = timeline.at(-1).km - first
  const values = []
  let i = 1
  for (let k = 0; k <= count; k++) {
    const km = first + (total * k) / count
    while (i < timeline.length - 1 && timeline[i].km < km) i++
    const a = timeline[i - 1]
    const b = timeline[i]
    values.push(lerp(a[key], b[key], b.km > a.km ? clamp((km - a.km) / (b.km - a.km), 0, 1) : 0))
  }
  return values
}

export function rideAdvice(timeline, summary, formatTime) {
  const at = (i) => `km ${Math.round(timeline[i].km)} (${formatTime(timeline[i].eta)})`
  const tips = []
  const isCold = (p) => p.tempC < COMFORT_MIN_C
  const firstCold = timeline.findIndex(isCold)
  if (firstCold === 0) {
    const warmer = timeline.findIndex((p) => !isCold(p))
    tips.push(warmer === -1 ? 'Below 15°C the whole way. Dress for the cold.' : `Below 15°C until ${at(warmer)}. Start with arm warmers.`)
  } else if (firstCold > 0) {
    tips.push(`Drops below 15°C around ${at(firstCold)}. Bring a layer.`)
  }
  const firstHot = timeline.findIndex((p) => p.tempC >= HOT_C)
  if (firstHot >= 0) tips.push(`Above ${HOT_C}°C from ${at(firstHot)}. Carry extra water.`)
  if (summary.maxRainChance >= RAINY_CHANCE) {
    tips.push(`${Math.round(summary.maxRainChance)}% chance of rain around ${at(summary.rainIndex)}. Pack a rain jacket.`)
  }
  return tips.length ? tips : ['Comfortable the whole way.']
}

export async function analyzeRoute(route, { startMs, speedKph, apiKey, signal, getForecasts = fetchForecasts }) {
  const etas = estimateArrivalTimes(route.points, startMs, speedKph)
  const samplePoints = route.sampleIdx.map((i) => route.points[i])
  const sampleEtas = route.sampleIdx.map((i) => etas[i])
  const forecasts = await getForecasts(samplePoints, sampleEtas[0], sampleEtas.at(-1), { apiKey, signal })
  const conditions = forecasts.map((series, j) => conditionsAt(series, sampleEtas[j]))
  const timeline = buildRouteTimeline(route.points, route.sampleIdx, conditions, etas)
  const summary = summarizeRide(timeline)
  return { ...calculateRouteScore(summary), summary, timeline }
}
