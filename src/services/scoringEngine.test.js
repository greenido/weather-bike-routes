import { describe, expect, it } from 'vitest'
import { calculateRouteScore, colorForScore, windPenalty } from './scoringEngine'

const ideal = {
  avgWindKph: 5,
  avgHeadwindKph: 0,
  maxGustKph: 10,
  feelsLikeC: [18, 18, 18],
  maxRainChance: 0,
  avgVisibilityKm: 20,
}

describe('calculateRouteScore', () => {
  it('gives an ideal ride a 10 with nothing deducted', () => {
    expect(calculateRouteScore(ideal)).toEqual({ score: 10, breakdown: { wind: 0, temperature: 0, rain: 0, visibility: 0 } })
  })

  it('returns a breakdown that adds up to the score', () => {
    const { score, breakdown } = calculateRouteScore({ ...ideal, avgWindKph: 20, avgHeadwindKph: 10, maxRainChance: 35, avgVisibilityKm: 8 })
    const total = breakdown.wind + breakdown.temperature + breakdown.rain + breakdown.visibility
    expect(score).toBeCloseTo(10 - total, 6)
    expect(breakdown).toEqual({ wind: 2.1, temperature: 0, rain: 2, visibility: 1 })
  })

  it('averages temperature penalties along the ride instead of averaging temperatures', () => {
    // A 12°C first half and a 26°C second half averages to an "ideal" 19°C, but both halves are uncomfortable.
    const { breakdown } = calculateRouteScore({ ...ideal, feelsLikeC: [12, 12, 26, 26] })
    expect(breakdown.temperature).toBe(1)
  })

  it('sets the score to 1 when it feels hotter than 40°C on average', () => {
    expect(calculateRouteScore({ ...ideal, feelsLikeC: [41, 42] }).score).toBe(1)
  })

  it.each([[10, 0], [15, 1], [30, 2], [50, 3], [70, 4]])('removes points for a %s%% chance of rain', (chance, penalty) => {
    expect(calculateRouteScore({ ...ideal, maxRainChance: chance }).breakdown.rain).toBe(penalty)
  })

  it.each([[12, 0], [9, 1], [4, 2], [1, 3]])('removes points for %s km visibility', (km, penalty) => {
    expect(calculateRouteScore({ ...ideal, avgVisibilityKm: km }).breakdown.visibility).toBe(penalty)
  })

  it('never goes below 1', () => {
    const awful = { avgWindKph: 50, avgHeadwindKph: 50, maxGustKph: 80, feelsLikeC: [2], maxRainChance: 90, avgVisibilityKm: 1 }
    expect(calculateRouteScore(awful).score).toBe(1)
  })
})

describe('windPenalty', () => {
  const wind = (avgWindKph, avgHeadwindKph, maxGustKph = 0) => windPenalty({ avgWindKph, avgHeadwindKph, maxGustKph })

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
    expect(wind(10, 0, 45)).toBe(1)
    expect(wind(10, 0, 60)).toBe(2)
  })
})

describe('colorForScore', () => {
  it('uses colors that stay readable on white', () => {
    expect([colorForScore(9), colorForScore(7), colorForScore(3)]).toEqual(['#15803d', '#b45309', '#b91c1c'])
  })
})
