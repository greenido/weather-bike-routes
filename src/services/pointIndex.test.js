import { describe, expect, it } from 'vitest'
import { buildPointIndex, CELL_PX, nearestPointWithin } from './pointIndex'

const at = (x, y) => ({ x, y })
// What the index replaces: the closest point within the radius, found by walking every point.
const byScan = (points, { x, y }, radiusPx = CELL_PX) => {
  let best = null
  let bestPx = radiusPx
  points.forEach((p, i) => {
    const px = Math.hypot(p.x - x, p.y - y)
    if (px < bestPx) {
      bestPx = px
      best = i
    }
  })
  return best
}

describe('nearestPointWithin', () => {
  const points = [at(0, 0), at(100, 100), at(105, 98), at(400, 20)]
  const index = buildPointIndex(points)

  it('finds the nearest point and ignores everything outside the radius', () => {
    expect(nearestPointWithin(index, at(101, 101))).toBe(1)
    expect(nearestPointWithin(index, at(104, 97))).toBe(2)
    expect(nearestPointWithin(index, at(250, 250))).toBeNull()
  })

  it('finds a point in a neighbouring cell, not just the one under the pointer', () => {
    // Just inside one cell, with the point just inside the next one along.
    const straddling = buildPointIndex([at(CELL_PX + 1, CELL_PX + 1)])
    expect(nearestPointWithin(straddling, at(CELL_PX - 1, CELL_PX - 1))).toBe(0)
  })

  it('handles negative coordinates, which Leaflet produces north and west of the origin', () => {
    const negative = buildPointIndex([at(-300, -300), at(-301, -302)])
    expect(nearestPointWithin(negative, at(-300, -301))).toBe(0)
  })

  it('agrees with a plain scan over a dense route', () => {
    // A 2,000-point route, the app's cap, folded so points from different stretches sit near each other.
    const dense = Array.from({ length: 2000 }, (_, i) => at(Math.round(i * 0.7) % 800, Math.round(i * 0.31) % 600))
    const denseIndex = buildPointIndex(dense)
    for (let x = 0; x < 800; x += 37) {
      for (let y = 0; y < 600; y += 41) {
        expect(nearestPointWithin(denseIndex, at(x, y))).toBe(byScan(dense, at(x, y)))
      }
    }
  })

  it('returns null for a route with no points', () => {
    expect(nearestPointWithin(buildPointIndex([]), at(0, 0))).toBeNull()
  })
})
