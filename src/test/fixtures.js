/*
  File: src/test/fixtures.js
  Purpose: Small synthetic rides for the component and app tests.
  What it does:
  - makeTimeline(options): conditions at every point of a straight ride north that warms steadily from `fromC`
    to `toC` (a point every km by default).
  - makeRoute(options): the same ride in the shape the GPX parser returns ({ points, totalKm, sampleIdx }).
  - makeAnalyzedRoute(options): a route with `analysis` filled in by the real summary and scoring code.
*/
import { summarizeRide } from '../services/routeAnalysis'
import { calculateRouteScore } from '../services/scoringEngine'

export const START_MS = Date.UTC(2026, 8, 12, 7)
const HOUR_MS = 60 * 60 * 1000

export function makeTimeline({ km = 10, points = 11, lat = 45, fromC = 12, toC = 24, windKph = 9, windFromDeg = 135, rainChance = 0 } = {}) {
  return Array.from({ length: points }, (_, i) => {
    const f = i / (points - 1)
    const tempC = fromC + f * (toC - fromC)
    return {
      lat: lat + (f * km) / 111.2,
      lon: 7,
      km: f * km,
      ele: 200 + 100 * Math.sin(f * Math.PI),
      eta: START_MS + ((f * km) / 20) * HOUR_MS,
      tempC,
      feelsLikeC: tempC - 1,
      windKph,
      windFromDeg,
      gustKph: windKph + 5,
      rainChance,
      visibilityKm: 20,
    }
  })
}

export function makeRoute(options = {}) {
  const timeline = makeTimeline(options)
  const last = timeline.length - 1
  return {
    points: timeline.map(({ lat, lon, ele, km }) => ({ lat, lon, ele, km })),
    totalKm: timeline[last].km,
    sampleIdx: [0, Math.round(last / 2), last],
  }
}

export function makeAnalyzedRoute({ id = 'route-1', name = 'route.gpx', ...options } = {}) {
  const timeline = makeTimeline(options)
  const summary = summarizeRide(timeline)
  return { id, name, ...makeRoute(options), analysis: { ...calculateRouteScore(summary), summary, timeline } }
}
