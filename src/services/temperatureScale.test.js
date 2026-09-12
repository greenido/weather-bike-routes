import { describe, expect, it } from 'vitest'
import { TEMP_STOPS, colorRuns, temperatureColor, temperatureTextColor } from './temperatureScale'

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const strongest = (hex) => ['red', 'green', 'blue'][channels(hex).reduce((best, v, i, all) => (v > all[best] ? i : best), 0)]

describe('temperatureColor', () => {
  it('uses each stop color at its temperature', () => {
    TEMP_STOPS.forEach(([tempC, color]) => expect(temperatureColor(tempC)).toBe(color))
  })

  it('blends between stops', () => {
    // Halfway between 15°C (#09cdb4) and 19°C (#5dd967).
    expect(temperatureColor(17)).toBe('#33d38e')
  })

  it('keeps the end colors beyond the scale', () => {
    expect(temperatureColor(-20)).toBe(TEMP_STOPS[0][1])
    expect(temperatureColor(48)).toBe(TEMP_STOPS.at(-1)[1])
  })

  it('reads blue when cold, green when comfortable, and red when hot', () => {
    expect([-5, 0, 5, 10].map((t) => strongest(temperatureColor(t)))).toEqual(Array(4).fill('blue'))
    expect([15, 18.5, 22].map((t) => strongest(temperatureColor(t)))).toEqual(Array(3).fill('green'))
    expect([26, 30, 35, 40].map((t) => strongest(temperatureColor(t)))).toEqual(Array(4).fill('red'))
  })
})

describe('temperatureTextColor', () => {
  it('keeps label text readable on every color of the scale', () => {
    for (let tempC = -10; tempC <= 45; tempC += 0.25) {
      expect(contrast(temperatureColor(tempC), temperatureTextColor(tempC))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('writes white on the dark ends and black on the light middle', () => {
    expect([-5, 18, 40].map(temperatureTextColor)).toEqual(['#ffffff', '#000000', '#ffffff'])
  })
})

describe('colorRuns', () => {
  it('starts a new stretch every half degree and shares boundary points', () => {
    expect(colorRuns([10, 10.25, 10.5, 10.75, 11, 11.25])).toEqual([
      { start: 0, end: 2, color: temperatureColor(10.25) },
      { start: 2, end: 4, color: temperatureColor(10.75) },
      { start: 4, end: 5, color: temperatureColor(11.125) },
    ])
  })

  it('does not split the line on small ups and downs', () => {
    expect(colorRuns([18, 18.3, 17.8, 18.2, 17.9, 18.1])).toEqual([{ start: 0, end: 5, color: temperatureColor(18.05) }])
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
