import { describe, expect, it } from 'vitest'
import { labelMarks, placeLabels } from './mapLabels'
import { makeTimeline } from '../test/fixtures'

// A 30 × 20 px label centered on (x, y).
const box = (x, y = 0) => ({ x, x0: x - 15, x1: x + 15, y0: y - 10, y1: y + 10 })
const xs = (boxes) => boxes.map((b) => b.x)

describe('labelMarks', () => {
  it('offers every whole km, rounder marks first', () => {
    // 12 km with a point every 500 m, so km k is point 2k.
    const marks = labelMarks(makeTimeline({ km: 12, points: 25 }))
    expect(marks).toEqual([10, 5, 2, 4, 6, 8, 1, 3, 7, 9, 11].map((km) => 2 * km))
  })

  it('spreads the marks out on long rides', () => {
    const timeline = makeTimeline({ km: 200, points: 401 })
    const kms = labelMarks(timeline).map((i) => Math.round(timeline[i].km))
    expect(kms).toHaveLength(39)
    expect(kms.every((km) => km % 5 === 0)).toBe(true)
    expect(kms.slice(0, 3)).toEqual([100, 50, 150])
  })

  it('offers each point once, and never the start or finish', () => {
    // Points at km 0, 3, and 6: every mark is nearest to one of those.
    expect(labelMarks(makeTimeline({ km: 6, points: 3 }))).toEqual([1])
  })
})

describe('placeLabels', () => {
  it('keeps labels a gap apart, first come first served', () => {
    const candidates = [0, 50, 100, 150, 200].map((x) => box(x))
    expect(xs(placeLabels(candidates, { gapPx: 60 }))).toEqual([0, 100, 200])
  })

  it('keeps clear of the labels that are always shown', () => {
    const candidates = [0, 100, 200].map((x) => box(x))
    expect(xs(placeLabels(candidates, { labels: [box(80)], gapPx: 60 }))).toEqual([200])
  })

  it('only skips a label that would cover a blocked spot, like an arrow', () => {
    const arrow = { x0: 193, x1: 207, y0: -7, y1: 7 }
    const candidates = [box(200), box(225)]
    expect(xs(placeLabels(candidates, { blocked: [arrow], gapPx: 60 }))).toEqual([225])
  })

  it('does not stack the way back on top of the way out', () => {
    const outAndBack = [0, 100, 200, 100, 0].map((x) => box(x))
    expect(placeLabels(outAndBack, { gapPx: 60 })).toEqual(outAndBack.slice(0, 3))
  })
})
