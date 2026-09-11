// @vitest-environment happy-dom
// Parsing uses the browser's DOMParser, so these tests run in a simulated browser.
import { describe, expect, it } from 'vitest'
import { parseGpxText, sampleByDistance, sampleStepKm } from './gpxParser'

const gpx = (body) => `<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`
const pt = (tag) => ([lat, lon, ele]) => `<${tag} lat="${lat}" lon="${lon}">${ele == null ? '' : `<ele>${ele}</ele>`}</${tag}>`
const eastward = (n, lonSpan) => Array.from({ length: n }, (_, i) => [45, 7 + (i / (n - 1)) * lonSpan, 100 + i])
const track = (points) => `<trk><trkseg>${points.map(pt('trkpt')).join('')}</trkseg></trk>`

describe('parseGpxText', () => {
  it('reads track points with cumulative distance and elevation', () => {
    const route = parseGpxText(gpx(track(eastward(101, 1.27))))
    expect(route.points).toHaveLength(101)
    expect(route.totalKm).toBeCloseTo(99.9, 0)
    expect(route.points[0].km).toBe(0)
    expect(route.points.at(-1).km).toBeCloseTo(route.totalKm, 6)
    expect(route.points[10].ele).toBe(110)
  })

  it('samples weather every 5 km along the whole route, not just the ends', () => {
    const route = parseGpxText(gpx(track(eastward(1000, 1.27))))
    expect(route.sampleIdx).toHaveLength(21)
    expect(route.sampleIdx[0]).toBe(0)
    expect(route.sampleIdx.at(-1)).toBe(999)
  })

  it('joins multiple track segments', () => {
    const [a, b] = [eastward(5, 0.1), eastward(5, 0.1).map(([lat, lon, ele]) => [lat, lon + 0.1, ele])]
    const route = parseGpxText(gpx(`<trk><trkseg>${a.map(pt('trkpt')).join('')}</trkseg><trkseg>${b.map(pt('trkpt')).join('')}</trkseg></trk>`))
    expect(route.points).toHaveLength(10)
  })

  it('falls back to route points when the file has no track', () => {
    const route = parseGpxText(gpx(`<rte>${eastward(4, 0.1).map(pt('rtept')).join('')}</rte>`))
    expect(route.points).toHaveLength(4)
    expect(route.totalKm).toBeGreaterThan(7)
  })

  it('keeps points on the equator and the prime meridian', () => {
    const route = parseGpxText(gpx(track([[0, 0, 5], [0, 0.01, 5], [0.01, 0.01, 5]])))
    expect(route.points).toHaveLength(3)
  })

  it('reads GPX 1.0 files and files without a namespace', () => {
    const points = [[45, 7, 200], [45, 7.01, 210]]
    const gpx10 = `<?xml version="1.0"?><gpx version="1.0" xmlns="http://www.topografix.com/GPX/1/0">${track(points)}</gpx>`
    expect(parseGpxText(gpx10).points.map((p) => p.ele)).toEqual([200, 210])
    expect(parseGpxText(`<gpx>${track(points)}</gpx>`).points).toHaveLength(2)
  })

  it('ignores waypoints and device extensions', () => {
    const withExtras = `<wpt lat="46" lon="8"><ele>999</ele></wpt><trk><trkseg>
      <trkpt lat="45" lon="7"><ele>100</ele><extensions><gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="45" lon="7.01"><ele>101</ele></trkpt>
    </trkseg></trk>`
    const route = parseGpxText(gpx(withExtras))
    expect(route.points.map((p) => [p.lat, p.lon, p.ele])).toEqual([[45, 7, 100], [45, 7.01, 101]])
  })

  it('stores missing elevation as null', () => {
    const route = parseGpxText(gpx(track([[45, 7], [45, 7.01]])))
    expect(route.points.map((p) => p.ele)).toEqual([null, null])
  })

  it('throws a readable error when the file has no points', () => {
    expect(() => parseGpxText(gpx(''))).toThrow('No track or route points found')
    expect(() => parseGpxText('not xml at all')).toThrow('No track or route points found')
  })

  it('thins very dense tracks but keeps both ends and the true distance', () => {
    const route = parseGpxText(gpx(track(eastward(5000, 1.27))))
    expect(route.points.length).toBeLessThanOrEqual(2001)
    expect(route.points[0].lon).toBe(7)
    expect(route.points.at(-1).lon).toBeCloseTo(8.27, 6)
    expect(route.points.at(-1).km).toBeCloseTo(route.totalKm, 6)
  })
})

describe('sampleStepKm', () => {
  it('uses 5 km for typical rides and stretches for long ones', () => {
    expect(sampleStepKm(72)).toBe(5)
    expect(sampleStepKm(400)).toBe(10)
  })
})

describe('sampleByDistance', () => {
  const evenly = (km, stepKm) => Array.from({ length: Math.round(km / stepKm) + 1 }, (_, i) => ({ km: i * stepKm }))

  it('always includes both ends', () => {
    expect(sampleByDistance(evenly(1, 1), 5)).toEqual([0, 1])
  })

  it('samples at the requested spacing', () => {
    const points = evenly(30, 0.1)
    const kms = sampleByDistance(points, 5).map((i) => Math.round(points[i].km))
    expect(kms).toEqual([0, 5, 10, 15, 20, 25, 30])
  })

  it('drops a sample that would sit right before the finish', () => {
    const points = evenly(31, 0.1)
    const kms = sampleByDistance(points, 5).map((i) => Math.round(points[i].km))
    expect(kms).toEqual([0, 5, 10, 15, 20, 25, 31])
  })
})
