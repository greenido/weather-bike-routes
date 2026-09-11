/*
  File: src/services/temperatureScale.js
  Purpose: The shared color scale for "temperature when you get there" (map line, thumbnails, profile, legend).
  What it does:
  - Splits temperatures into 7 bins: three cold (blue), the 15–22°C comfort band (neutral gray), three warm (red).
  - temperatureBin(tempC) / temperatureColor(tempC): map a temperature to its bin index / hex color.
  - colorRuns(temps): groups consecutive points that share a bin, so a route draws as a few polylines, not thousands.
  Notes:
  - Stepped (not continuous) colors keep neighbors distinguishable; both arms were checked for monotone lightness and contrast.
*/
export const COMFORT_MIN_C = 15
export const COMFORT_MAX_C = 22

export const TEMP_EDGES = [5, 10, COMFORT_MIN_C, COMFORT_MAX_C, 27, 32]
export const TEMP_COLORS = ['#185FA5', '#378ADD', '#85B7EB', '#B4B2A9', '#F09595', '#E24B4A', '#A32D2D']
export const TEMP_LABELS = ['<5', '5–10', '10–15', '15–22', '22–27', '27–32', '>32']
export const COMFORT_BIN = 3

export function temperatureBin(tempC) {
  let bin = 0
  while (bin < TEMP_EDGES.length && tempC >= TEMP_EDGES[bin]) bin++
  return bin
}

export function temperatureColor(tempC) {
  return TEMP_COLORS[temperatureBin(tempC)]
}

// Runs share their boundary point so adjacent polylines connect without gaps.
export function colorRuns(temps) {
  const runs = []
  let start = 0
  for (let i = 1; i <= temps.length; i++) {
    if (i === temps.length || temperatureBin(temps[i]) !== temperatureBin(temps[start])) {
      runs.push({ start, end: Math.min(i, temps.length - 1), bin: temperatureBin(temps[start]) })
      start = i
    }
  }
  return runs.filter((run) => run.end > run.start || temps.length === 1)
}
