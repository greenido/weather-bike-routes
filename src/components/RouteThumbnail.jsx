/*
  File: src/components/RouteThumbnail.jsx
  Purpose: Lightweight SVG sketch of a route for the list, colored by temperature once the forecast is in.
  What it does:
  - Projects lat/lon into a small SVG (longitude scaled by cos(latitude) so shapes aren't stretched).
  - Draws a dark casing plus one polyline per same-temperature run; a neutral line while the forecast loads.
  Notes:
  - Replaces a full Leaflet map per card: no tiles to download and no map instances to keep alive.
*/
import { useMemo } from 'react'
import { colorRuns } from '../services/temperatureScale'

const W = 160
const H = 112
const PAD = 10
const MAX_POINTS = 300
const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }

export default function RouteThumbnail({ points, timeline }) {
  const indices = useMemo(() => {
    const step = Math.ceil(points.length / MAX_POINTS)
    const picked = points.map((_, i) => i).filter((i) => i % step === 0)
    if (picked.at(-1) !== points.length - 1) picked.push(points.length - 1)
    return picked
  }, [points])
  const xy = useMemo(() => project(indices.map((i) => points[i])), [indices, points])
  const runs = useMemo(() => (timeline ? colorRuns(indices.map((i) => timeline[i].tempC)) : null), [indices, timeline])
  const path = (from, to) => xy.slice(from, to + 1).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" aria-hidden="true">
      <rect width={W} height={H} className="fill-slate-50 dark:fill-slate-900" />
      <polyline points={path(0, xy.length - 1)} {...LINE} strokeWidth="5" className="stroke-black/[0.55] dark:stroke-black/[0.75]" />
      {runs
        ? runs.map((run) => <polyline key={run.start} points={path(run.start, run.end)} {...LINE} stroke={run.color} strokeWidth="3" />)
        : <polyline points={path(0, xy.length - 1)} {...LINE} stroke="#B4B2A9" strokeWidth="3" />}
      <circle cx={xy[0][0]} cy={xy[0][1]} r="3.5" fill="#0b0b0b" strokeWidth="1.5" className="stroke-white dark:stroke-slate-300" />
    </svg>
  )
}

function project(points) {
  const cosLat = Math.cos((points[0].lat * Math.PI) / 180)
  const xs = points.map((p) => p.lon * cosLat)
  const ys = points.map((p) => -p.lat)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const scale = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1))
  const offsetX = (W - (maxX - minX) * scale) / 2
  const offsetY = (H - (maxY - minY) * scale) / 2
  return xs.map((x, i) => [offsetX + (x - minX) * scale, offsetY + (ys[i] - minY) * scale])
}
