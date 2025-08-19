import GPX from 'gpxparser'

export function parseGpxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read GPX file'))
    reader.onload = () => {
      try {
        const gpx = new GPX()
        gpx.parse(reader.result)
        resolve(gpx)
      } catch (error) {
        reject(error)
      }
    }
    reader.readAsText(file)
  })
}

export function extractWaypointsAtInterval(gpx, intervalKm = 10) {
  const tracks = gpx.tracks || []
  const points = []
  for (const track of tracks) {
    for (const segment of track.points ? [track] : track?.segments || []) {
      const segPoints = segment.points || segment
      for (const p of segPoints) {
        if (p.lat && p.lon) points.push({ lat: p.lat, lon: p.lon })
      }
    }
  }
  if (points.length === 0) return []

  // Take first, interval, last
  const sampled = []
  const step = Math.max(1, Math.floor(points.length / Math.max(1, Math.floor((gpx.distance || 0) / (intervalKm * 1000)))))
  for (let i = 0; i < points.length; i += step) sampled.push(points[i])
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1])
  return sampled
}

export function estimateRouteHeading(gpx) {
  const tracks = gpx.tracks || []
  for (const track of tracks) {
    const pts = track.points || track?.segments?.[0]?.points || []
    if (pts.length >= 2) {
      const start = pts[0]
      const end = pts[pts.length - 1]
      const dLon = (end.lon - start.lon) * Math.PI / 180
      const lat1 = start.lat * Math.PI / 180
      const lat2 = end.lat * Math.PI / 180
      const y = Math.sin(dLon) * Math.cos(lat2)
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
      const brng = Math.atan2(y, x) * 180 / Math.PI
      return (brng + 360) % 360
    }
  }
  return 0
}


