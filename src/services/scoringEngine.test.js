import { describe, expect, it } from 'vitest'
import { calculateRouteScore, ramp, scoreToneClass, windPenalty } from './scoringEngine'

const ideal = {
  avgWindKph: 5,
  avgHeadwindKph: 0,
  gustKph: [10, 10, 10],
  feelsLikeC: [18, 18, 18],
  rainChance: [0, 0, 0],
  avgVisibilityKm: 20,
}

const filled = (value, count = 8) => Array.from({ length: count }, () => value)

describe('ramp', () => {
  const knots = [[0, 0], [10, 1], [30, 2]]

  it('holds the end penalties outside the knots', () => {
    expect(ramp(-5, knots)).toBe(0)
    expect(ramp(100, knots)).toBe(2)
  })

  it('returns each knot exactly', () => {
    expect([ramp(0, knots), ramp(10, knots), ramp(30, knots)]).toEqual([0, 1, 2])
  })

  it('interpolates between knots, with no jump at a knot', () => {
    expect(ramp(5, knots)).toBeCloseTo(0.5)
    expect(ramp(20, knots)).toBeCloseTo(1.5)
    expect(ramp(9.99, knots)).toBeCloseTo(ramp(10.01, knots), 2)
  })
})

describe('calculateRouteScore', () => {
  it('gives an ideal ride a 10 with nothing deducted', () => {
    expect(calculateRouteScore(ideal)).toEqual({ score: 10, breakdown: { wind: 0, temperature: 0, rain: 0, visibility: 0 } })
  })

  it('returns a breakdown that adds up to the score', () => {
    const { score, breakdown } = calculateRouteScore({ ...ideal, avgWindKph: 20, avgHeadwindKph: 10, rainChance: filled(35), avgVisibilityKm: 8 })
    const total = breakdown.wind + breakdown.temperature + breakdown.rain + breakdown.visibility
    expect(score).toBeCloseTo(10 - total, 6)
    expect(breakdown).toEqual({ wind: 2.1, temperature: 0, rain: 1.7, visibility: 0.9 })
  })

  it('averages temperature penalties along the ride instead of averaging temperatures', () => {
    // A 12°C first half and a 26°C second half averages to an "ideal" 19°C, but both halves are uncomfortable.
    const { breakdown } = calculateRouteScore({ ...ideal, feelsLikeC: [12, 12, 26, 26] })
    expect(breakdown.temperature).toBe(1.1)
  })

  it('sets the score to 1 when it feels hotter than 40°C on average', () => {
    expect(calculateRouteScore({ ...ideal, feelsLikeC: [41, 42] }).score).toBe(1)
  })

  it('charges for rain over the whole ride, not just the wettest point', () => {
    const shower = calculateRouteScore({ ...ideal, rainChance: [80, 0, 0, 0, 0, 0, 0, 0] })
    const allDay = calculateRouteScore({ ...ideal, rainChance: filled(80) })
    expect(allDay.breakdown.rain).toBe(3.8)
    expect(shower.breakdown.rain).toBeCloseTo(3.8 / 8, 1)
  })

  it('charges for gusts over the whole ride, not just the strongest one', () => {
    const oneSquall = calculateRouteScore({ ...ideal, gustKph: [65, 10, 10, 10] })
    const blowyAllDay = calculateRouteScore({ ...ideal, gustKph: filled(65, 4) })
    expect(blowyAllDay.breakdown.wind).toBe(2)
    expect(oneSquall.breakdown.wind).toBe(0.5)
  })

  it.each([[5, 0], [22, 1], [40, 2], [60, 3], [85, 4], [95, 4]])('removes points for a %s%% chance of rain', (chance, penalty) => {
    expect(calculateRouteScore({ ...ideal, rainChance: filled(chance) }).breakdown.rain).toBe(penalty)
  })

  it.each([[20, 0], [12, 0], [7.5, 1], [3.5, 2], [1, 3]])('removes points for %s km visibility', (km, penalty) => {
    expect(calculateRouteScore({ ...ideal, avgVisibilityKm: km }).breakdown.visibility).toBe(penalty)
  })

  it('moves smoothly when a factor drifts past an old band edge', () => {
    const at = (avgVisibilityKm) => calculateRouteScore({ ...ideal, avgVisibilityKm }).score
    expect(Math.abs(at(9.9) - at(10.1))).toBeLessThan(0.2)
  })

  it('never goes below 1', () => {
    const awful = { avgWindKph: 50, avgHeadwindKph: 50, gustKph: [80], feelsLikeC: [2], rainChance: [90], avgVisibilityKm: 1 }
    expect(calculateRouteScore(awful).score).toBe(1)
  })
})

describe('windPenalty', () => {
  const wind = (avgWindKph, avgHeadwindKph, gustKph = [0]) => windPenalty({ avgWindKph, avgHeadwindKph, gustKph })

  it('scales a net headwind up to ×1.8', () => {
    expect(wind(20, 20)).toBeCloseTo(2.7)
  })

  it('treats wind that evens out over a loop as plain wind', () => {
    expect(wind(20, 0)).toBe(1.5)
  })

  it('gives a strong tailwind the full +1.5 bonus', () => {
    expect(wind(20, -20)).toBe(0)
    expect(wind(10, -10)).toBe(-1)
  })

  it('gives only a small bonus for a light breeze from behind', () => {
    expect(wind(3, -3)).toBeCloseTo(-0.3)
  })

  it('adds gust penalties', () => {
    expect(wind(10, 0, [47])).toBeCloseTo(1)
    expect(wind(10, 0, [65])).toBeCloseTo(2)
  })
})

describe('scoreToneClass', () => {
  it('gives each band a color for both themes', () => {
    expect([scoreToneClass(9), scoreToneClass(7), scoreToneClass(3)]).toEqual([
      'text-green-700 dark:text-green-400',
      'text-amber-700 dark:text-amber-400',
      'text-red-700 dark:text-red-400',
    ])
  })
})
