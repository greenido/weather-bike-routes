/*
  File: src/services/gpxParser.js
  Purpose: Parse GPX files into a normalized route and pick the points where weather is sampled.
  What it does:
  - parseGpxFile(file) / parseGpxText(text): reads <trk> points (or <rte> points when a file has no track) into
    { points: [{ lat, lon, ele, km }], totalKm, sampleIdx }, where km is the distance from the start.
  - Thins very dense tracks to about MAX_POINTS points so the map, chart, and analysis stay fast.
  - sampleStepKm(totalKm): weather sampling interval — every 5 km, stretched on long routes to cap the request size.
  - sampleByDistance(points, stepKm): indices of the sampled points (first and last are always included).
*/
import GPX from 'gpxparser'
import { haversineKm } from './geo'

const MAX_POINTS = 2000
const MAX_SAMPLES = 40
const MIN_STEP_KM = 5

export function parseGpxFile(file) {
  return file.text().then(parseGpxText)
}

export function parseGpxText(text) {
  const gpx = new GPX()
  gpx.parse(text)
  const trackPoints = gpx.tracks.flatMap((track) => track.points)
  const raw = (trackPoints.length ? trackPoints : gpx.routes.flatMap((route) => route.points))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (raw.length < 2) throw new Error('No track or route points found')

  let km = 0
  const all = raw.map((p, i) => {
    if (i > 0) km += haversineKm(raw[i - 1], p)
    return { lat: p.lat, lon: p.lon, ele: Number.isFinite(p.ele) ? p.ele : null, km }
  })
  const points = all.length > MAX_POINTS ? thinByDistance(all, km / MAX_POINTS) : all
  return { points, totalKm: km, sampleIdx: sampleByDistance(points, sampleStepKm(km)) }
}

export function sampleStepKm(totalKm) {
  return Math.max(MIN_STEP_KM, totalKm / MAX_SAMPLES)
}

export function sampleByDistance(points, stepKm) {
  const last = points.length - 1
  const indices = [0]
  let nextKm = stepKm
  for (let i = 1; i < last; i++) {
    if (points[i].km >= nextKm) {
      indices.push(i)
      nextKm = points[i].km + stepKm
    }
  }
  // A sample just before the finish adds a request without adding information.
  if (indices.length > 1 && points[last].km - points[indices.at(-1)].km < stepKm / 3) indices.pop()
  indices.push(last)
  return indices
}

function thinByDistance(points, minKm) {
  const kept = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].km - kept.at(-1).km >= minKm) kept.push(points[i])
  }
  kept.push(points.at(-1))
  return kept
}
