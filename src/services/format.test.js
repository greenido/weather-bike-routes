import { describe, expect, it } from 'vitest'
import { compassPoint } from './format'

describe('compassPoint', () => {
  it('names the nearest of the eight compass points', () => {
    expect([0, 44, 90, 135, 180, 225, 270, 315].map(compassPoint)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
  })

  it('wraps around north, including negative and large angles', () => {
    expect(compassPoint(350)).toBe('N')
    expect(compassPoint(-45)).toBe('NW')
    expect(compassPoint(810)).toBe('E')
  })
})
