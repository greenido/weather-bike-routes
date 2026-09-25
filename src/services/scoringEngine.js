/*
  File: src/services/scoringEngine.js
  Purpose: Turn a ride summary (weather along the route at the times you pass each point) into a 1–10 score.
  What it does:
  - calculateRouteScore(ride): returns { score, breakdown }. The breakdown holds the points each factor removed
    (negative = bonus), and the score is computed from those same numbers so the UI always adds up.
  - scoreToneClass(score): Tailwind text colors for the score, one pair per band, readable on the card in
    either theme (the light shades fall below 4.5:1 on a dark card, so dark mode needs its own).
  Scoring model (penalties are subtracted from 10; the result is clamped to 1–10):
  - Every factor is measured over the whole ride, and every penalty is a straight line between the numbers below,
    so a score moves smoothly when you change the start time or speed instead of jumping a whole point.
  - Wind: average wind costs 1.5 points at 20 km/h, 2.5 at 30, 3 at 40, 4 at 50, and nothing below 10.
    A net headwind scales that by up to ×1.8; a net tailwind earns up to +1.5 (the full bonus at 15 km/h of
    tailwind). Gusts cost 1 point at 47 km/h and 2 at 65, averaged over the ride like everything else.
  - Temperature: feels-like temperature at every point of the ride. 15–22°C is free; below that it costs 1 point
    at 12.5°C, 2 at 7.5 and 3 at 2.5, and above it 1 at 26°C, 2 at 32.5 and 3 at 37.5. An average above 40°C
    sets the score to 1.
  - Rain: the chance of rain at every point of the ride — 1 point at 22%, 2 at 40%, 3 at 60%, 4 at 85%. A shower
    over one hill costs far less than rain the whole way.
  - Visibility (average along the ride): 1 point at 7.5 km, 2 at 3.5 km, 3 at 1 km.
  Notes:
  - Rain, gusts and temperature are read from arrays resampled at even distances by `summarizeRide`, so every km
    counts the same however dense the GPX points are, and one bad point can't sink a whole ride.
*/
import { COMFORT_MAX_C, COMFORT_MIN_C } from './temperatureScale'

const round1 = (value) => Math.round(value * 10) / 10
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

// [value, penalty] knots, ascending by value. Between two knots the penalty is a straight line; past either end
// the nearest knot's penalty holds. Each knot sits in the middle of the band it replaced, so the model keeps its
// old severity without the cliffs at the band edges.
const WIND_KNOTS = [[10, 0], [20, 1.5], [30, 2.5], [40, 3], [50, 4]]
const GUST_KNOTS = [[35, 0], [47, 1], [65, 2]]
const RAIN_KNOTS = [[10, 0], [22, 1], [40, 2], [60, 3], [85, 4]]
// Ascending in km, so the penalty falls as you can see farther.
const VISIBILITY_KNOTS = [[1, 3], [3.5, 2], [7.5, 1], [12, 0]]
// Two knots at 0 hold the comfort band free of any penalty; outside it the cost ramps up either way.
const TEMPERATURE_KNOTS = [
  [2.5, 3], [7.5, 2], [12.5, 1], [COMFORT_MIN_C, 0],
  [COMFORT_MAX_C, 0], [26, 1], [32.5, 2], [37.5, 3],
]

const UNRIDEABLE_FEELS_LIKE_C = 40

export function ramp(value, knots) {
  const i = knots.findIndex(([v]) => v >= value)
  if (i === -1) return knots.at(-1)[1] // Past the last knot.
  if (i === 0) return knots[0][1] // Before the first one.
  const [v0, p0] = knots[i - 1]
  const [v1, p1] = knots[i]
  return p0 + ((p1 - p0) * (value - v0)) / (v1 - v0)
}

export function windPenalty({ avgWindKph, avgHeadwindKph, gustKph }) {
  const base = ramp(avgWindKph, WIND_KNOTS)
  const headShare = avgWindKph > 0 ? clamp(avgHeadwindKph / avgWindKph, -1, 1) : 0
  const headwind = headShare > 0 ? base * 0.8 * headShare : 0
  const tailwindBonus = avgHeadwindKph < 0 ? 1.5 * Math.min(1, -avgHeadwindKph / 15) : 0
  return base + headwind - tailwindBonus + mean(gustKph.map(gustPenalty))
}

export const gustPenalty = (kph) => ramp(kph, GUST_KNOTS)

export const temperaturePenalty = (feelsLikeC) => ramp(feelsLikeC, TEMPERATURE_KNOTS)

export const rainPenalty = (chance) => ramp(chance, RAIN_KNOTS)

export const visibilityPenalty = (visibilityKm) => ramp(visibilityKm, VISIBILITY_KNOTS)

export function calculateRouteScore(ride) {
  const breakdown = {
    wind: round1(windPenalty(ride)),
    temperature: round1(mean(ride.feelsLikeC.map(temperaturePenalty))),
    rain: round1(mean(ride.rainChance.map(rainPenalty))),
    visibility: round1(visibilityPenalty(ride.avgVisibilityKm)),
  }
  const total = breakdown.wind + breakdown.temperature + breakdown.rain + breakdown.visibility
  const score = mean(ride.feelsLikeC) > UNRIDEABLE_FEELS_LIKE_C ? 1 : clamp(10 - total, 1, 10)
  return { score: round1(score), breakdown }
}

export function scoreToneClass(score) {
  if (score >= 8) return 'text-green-700 dark:text-green-400'
  if (score >= 6) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}
