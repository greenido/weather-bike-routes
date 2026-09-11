/*
  File: src/services/format.js
  Purpose: Display formatters shared by the route list, the detail cards, and the profile chart.
*/
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export const formatTime = (ms) => timeFormat.format(ms)

export const formatDegrees = (tempC) => `${Math.round(tempC)}°`

export const compassPoint = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
