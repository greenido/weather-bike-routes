/*
  File: src/services/scoringEngine.js
  Purpose: Turn a ride summary (weather along the route at the times you pass each point) into a 1–10 score.
  What it does:
  - calculateRouteScore(ride): returns { score, breakdown }. The breakdown holds the points each factor removed
    (negative = bonus), and the score is computed from those same numbers so the UI always adds up.
  - colorForScore(score): accessible text color for the score (green / amber / red on white).
  Scoring model (penalties are subtracted from 10; the result is clamped to 1–10):
  - Wind: average wind >15 km/h −1.5, >25 −2.5, >35 −3, >45 −4. A net headwind scales that by up to ×1.8;
    a net tailwind earns up to +1.5 (the full bonus at 15 km/h of tailwind). Gusts >40 km/h −1, >55 km/h −2.
  - Temperature: feels-like temperature at every point of the ride (each km counts the same). 15–22°C is ideal;
    <15 −1, <10 −2, <5 −3; >22 −1, >30 −2, >35 −3. An average above 40°C sets the score to 1.
  - Rain: the highest chance of rain during the ride. ≥15% −1, ≥30% −2, ≥50% −3, ≥70% −4.
  - Visibility (average along the ride): <10 km −1, <5 km −2, <2 km −3.
*/
const round1 = (value) => Math.round(value * 10) / 10
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

export function windPenalty({ avgWindKph, avgHeadwindKph, maxGustKph }) {
  const base = avgWindKph > 45 ? 4 : avgWindKph > 35 ? 3 : avgWindKph > 25 ? 2.5 : avgWindKph > 15 ? 1.5 : 0
  const headShare = avgWindKph > 0 ? clamp(avgHeadwindKph / avgWindKph, -1, 1) : 0
  const headwind = headShare > 0 ? base * 0.8 * headShare : 0
  const tailwindBonus = avgHeadwindKph < 0 ? 1.5 * Math.min(1, -avgHeadwindKph / 15) : 0
  const gusts = maxGustKph > 55 ? 2 : maxGustKph > 40 ? 1 : 0
  return base + headwind - tailwindBonus + gusts
}

export function temperaturePenalty(feelsLikeC) {
  if (feelsLikeC < 5) return 3
  if (feelsLikeC < 10) return 2
  if (feelsLikeC < 15) return 1
  if (feelsLikeC > 35) return 3
  if (feelsLikeC > 30) return 2
  if (feelsLikeC > 22) return 1
  return 0
}

export function rainPenalty(chance) {
  return chance >= 70 ? 4 : chance >= 50 ? 3 : chance >= 30 ? 2 : chance >= 15 ? 1 : 0
}

export function visibilityPenalty(visibilityKm) {
  return visibilityKm < 2 ? 3 : visibilityKm < 5 ? 2 : visibilityKm < 10 ? 1 : 0
}

export function calculateRouteScore(ride) {
  const breakdown = {
    wind: round1(windPenalty(ride)),
    temperature: round1(mean(ride.feelsLikeC.map(temperaturePenalty))),
    rain: rainPenalty(ride.maxRainChance),
    visibility: visibilityPenalty(ride.avgVisibilityKm),
  }
  const total = breakdown.wind + breakdown.temperature + breakdown.rain + breakdown.visibility
  const score = mean(ride.feelsLikeC) > 40 ? 1 : clamp(10 - total, 1, 10)
  return { score: round1(score), breakdown }
}

export function colorForScore(score) {
  if (score >= 8) return '#15803d'
  if (score >= 6) return '#b45309'
  return '#b91c1c'
}
