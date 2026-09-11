import { describe, expect, it } from 'vitest'
import { COMFORT_BIN, TEMP_COLORS, colorRuns, temperatureBin, temperatureColor } from './temperatureScale'

describe('temperatureBin', () => {
  it.each([
    [-3, 0],
    [4.9, 0],
    [5, 1],
    [12, 2],
    [15, COMFORT_BIN],
    [21.9, COMFORT_BIN],
    [22, 4],
    [30, 5],
    [38, 6],
  ])('%s°C falls in bin %s', (temp, bin) => {
    expect(temperatureBin(temp)).toBe(bin)
  })

  it('maps colors by bin', () => {
    expect(temperatureColor(18)).toBe(TEMP_COLORS[COMFORT_BIN])
  })
})

describe('colorRuns', () => {
  it('merges consecutive points in the same bin and shares boundary points', () => {
    expect(colorRuns([12, 13, 16, 17, 18, 24, 25])).toEqual([
      { start: 0, end: 2, bin: 2 },
      { start: 2, end: 5, bin: COMFORT_BIN },
      { start: 5, end: 6, bin: 4 },
    ])
  })

  it('covers every segment of the line exactly once', () => {
    const temps = [3, 8, 8, 14, 19, 25, 29, 35, 19]
    const runs = colorRuns(temps)
    const covered = runs.reduce((sum, run) => sum + (run.end - run.start), 0)
    expect(covered).toBe(temps.length - 1)
    expect(runs[0].start).toBe(0)
    expect(runs.at(-1).end).toBe(temps.length - 1)
  })
})
