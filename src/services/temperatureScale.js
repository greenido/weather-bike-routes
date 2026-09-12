/*
  File: src/services/temperatureScale.js
  Purpose: The shared color scale for "temperature when you get there" (map line and labels, thumbnails, profile, legend).
  What it does:
  - A continuous ramp, like a weather map: violet and blue when it's cold, turquoise to green through the 15–22°C
    comfort band, then yellow, orange, and red as it gets hot. Colors between the TEMP_STOPS are interpolated.
  - temperatureColor(tempC): the color for a temperature. temperatureTextColor(tempC): black or white, whichever
    reads better on that color (at least 4.58:1 on any of them).
  - colorRuns(temps): splits a route into stretches of about the same temperature, so it draws as a few dozen
    polylines, not thousands.
  Notes:
  - The scale is absolute: a color means the same temperature on every route.
  - Lightness rises from the cold end to the comfort band and falls toward the hot end, and every degree changes the
    color by a similar amount. Colorblind riders can't tell green from orange well, so the map labels, the chart, and
    the table always show the numbers too.
*/
export const COMFORT_MIN_C = 15
export const COMFORT_MAX_C = 22

// [°C, color], coldest first. Colder or hotter than the ends keeps the end color.
export const TEMP_STOPS = [
  [-5, '#5e2b9a'],
  [0, '#494fcc'],
  [5, '#2a80e2'],
  [10, '#12aedb'],
  [15, '#09cdb4'],
  [19, '#5dd967'],
  [23, '#d9da26'],
  [27, '#fba100'],
  [31, '#ef6505'],
  [35, '#d72824'],
  [40, '#9d1135'],
]

// A new stretch starts once the temperature has moved this far, so GPS elevation noise doesn't split the line.
const RUN_STEP_C = 0.5
// Relative luminance where black and white text contrast equally (4.58:1); darker colors get white text.
const WHITE_TEXT_MAX_LUMINANCE = 0.179

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export function temperatureColor(tempC) {
  const i = TEMP_STOPS.findIndex(([t]) => t >= tempC)
  if (i === 0) return TEMP_STOPS[0][1]
  if (i === -1) return TEMP_STOPS.at(-1)[1]
  const [t0, c0] = TEMP_STOPS[i - 1]
  const [t1, c1] = TEMP_STOPS[i]
  const w = (tempC - t0) / (t1 - t0)
  const to = channels(c1)
  return `#${channels(c0).map((v, k) => Math.round(v + (to[k] - v) * w).toString(16).padStart(2, '0')).join('')}`
}

export function temperatureTextColor(tempC) {
  const [r, g, b] = channels(temperatureColor(tempC)).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b <= WHITE_TEXT_MAX_LUMINANCE ? '#ffffff' : '#000000'
}

// Runs share their boundary point so adjacent polylines connect without gaps. Each run takes the color of the
// temperature halfway between its ends.
export function colorRuns(temps) {
  const runs = []
  let start = 0
  for (let i = 1; i < temps.length; i++) {
    if (i === temps.length - 1 || Math.abs(temps[i] - temps[start]) >= RUN_STEP_C) {
      runs.push({ start, end: i, color: temperatureColor((temps[start] + temps[i]) / 2) })
      start = i
    }
  }
  return runs
}
