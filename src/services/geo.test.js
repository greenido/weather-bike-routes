import { describe, expect, it } from 'vitest'
import { bearingDeg, haversineKm } from './geo'

describe('haversineKm', () => {
  it('measures one degree of latitude as ~111 km', () => {
    expect(haversineKm({ lat: 45, lon: 7 }, { lat: 46, lon: 7 })).toBeCloseTo(111.2, 1)
  })

  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 45, lon: 7 }, { lat: 45, lon: 7 })).toBe(0)
  })
})

describe('bearingDeg', () => {
  const origin = { lat: 45, lon: 7 }
  it.each([
    ['north', { lat: 45.1, lon: 7 }, 0],
    ['east', { lat: 45, lon: 7.1 }, 90],
    ['south', { lat: 44.9, lon: 7 }, 180],
    ['west', { lat: 45, lon: 6.9 }, 270],
  ])('points %s', (_, target, expected) => {
    expect(bearingDeg(origin, target)).toBeCloseTo(expected, 0)
  })
})
