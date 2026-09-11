/*
  File: src/services/geo.js
  Purpose: Small spherical-geometry helpers shared by GPX parsing and wind analysis.
  What it does:
  - haversineKm(a, b): great-circle distance in km between two { lat, lon } points.
  - bearingDeg(a, b): initial compass bearing from a to b in degrees [0, 360).
*/
const EARTH_RADIUS_KM = 6371.0088
const toRad = (deg) => (deg * Math.PI) / 180

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDeg(a, b) {
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat))
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}
