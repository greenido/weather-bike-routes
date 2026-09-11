/*
  File: src/components/MapPreview.jsx
  Purpose: Leaflet map of the selected route, colored by the temperature you'll meet at each point.
  What it does:
  - Muted OpenStreetMap basemap (grayscaled with CSS, attribution shown) so the temperature colors stand out.
  - Draws a dark casing, then one polyline per same-temperature run, plus arrows showing the riding direction.
  - Labels start/finish, the coldest, and the warmest point; a marker follows the hovered point (`hoverIndex`).
  - Reports the route point nearest the pointer through `onHover(index | null)`.
  Notes:
  - The initial view comes from MapContainer `bounds`; the parent remounts this component per route.
  - Positions and path options are memoized: react-leaflet re-applies any prop whose reference changes, and the
    map re-renders on every hover.
*/
import { useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { bearingDeg, haversineKm } from '../services/geo'
import { TEMP_COLORS, colorRuns, temperatureColor } from '../services/temperatureScale'
import { formatDegrees } from '../services/format'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const CASING = 'rgba(11,11,11,0.55)'
const LINE = { lineCap: 'round', lineJoin: 'round', opacity: 1 }
const CASING_OPTIONS = { ...LINE, color: CASING, weight: 9 }
const HOVER_RADIUS_PX = 24
const ARROW_COUNT = 8

export default function MapPreview({ timeline, summary, hoverIndex, onHover }) {
  const positions = useMemo(() => timeline.map((p) => [p.lat, p.lon]), [timeline])
  const bounds = useMemo(() => L.latLngBounds(positions), [positions])
  const runs = useMemo(() => colorRuns(timeline.map((p) => p.tempC)).map((run) => ({
    key: `${run.start}-${run.bin}`,
    positions: positions.slice(run.start, run.end + 1),
    pathOptions: { ...LINE, color: TEMP_COLORS[run.bin], weight: 5 },
  })), [timeline, positions])
  const arrows = useMemo(() => directionArrows(timeline), [timeline])
  const labels = useMemo(() => routeLabels(timeline, summary), [timeline, summary])
  const hovered = hoverIndex == null ? null : timeline[hoverIndex]

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [28, 28] }} scrollWheelZoom={false} className="route-map h-full w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      <Polyline positions={positions} pathOptions={CASING_OPTIONS} interactive={false} />
      {runs.map((run) => (
        <Polyline key={run.key} positions={run.positions} pathOptions={run.pathOptions} interactive={false} />
      ))}
      {arrows.map((arrow) => (
        <Marker key={arrow.index} position={positions[arrow.index]} icon={arrow.icon} interactive={false} keyboard={false} />
      ))}
      {labels.map((label) => (
        <CircleMarker
          key={label.key}
          center={positions[label.index]}
          radius={label.key === 'start' ? 6 : 5}
          pathOptions={label.pathOptions}
          interactive={false}
        >
          <Tooltip permanent direction="top" offset={[0, -8]} className="route-label">{label.text}</Tooltip>
        </CircleMarker>
      ))}
      {hovered && (
        <CircleMarker
          center={[hovered.lat, hovered.lon]}
          radius={7}
          pathOptions={{ color: '#0b0b0b', weight: 2, fillOpacity: 1, fillColor: temperatureColor(hovered.tempC) }}
          interactive={false}
        />
      )}
      <HoverTracker positions={positions} onHover={onHover} />
    </MapContainer>
  )
}

function HoverTracker({ positions, onHover }) {
  const map = useMapEvents({
    mousemove(e) {
      let best = null
      let bestPx = HOVER_RADIUS_PX
      positions.forEach((position, i) => {
        const px = e.containerPoint.distanceTo(map.latLngToContainerPoint(position))
        if (px < bestPx) {
          bestPx = px
          best = i
        }
      })
      onHover(best)
    },
    mouseout() {
      onHover(null)
    },
  })
  return null
}

function directionArrows(timeline) {
  const totalKm = timeline.at(-1).km
  const arrows = []
  for (let k = 1; k < ARROW_COUNT; k++) {
    const index = timeline.findIndex((p) => p.km >= (k * totalKm) / ARROW_COUNT)
    const from = timeline[Math.max(0, index - 2)]
    const to = timeline[Math.min(timeline.length - 1, index + 2)]
    if (index > 0 && haversineKm(from, to) > 0) {
      const rotation = bearingDeg(from, to) - 90
      arrows.push({
        index,
        icon: L.divIcon({
          className: 'route-arrow',
          html: `<svg width="14" height="14" viewBox="-7 -7 14 14" style="transform: rotate(${rotation.toFixed(0)}deg)"><path d="M-3,-4 L2.5,0 L-3,4" fill="none" stroke="${CASING}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      })
    }
  }
  return arrows
}

function routeLabels(timeline, summary) {
  const first = timeline[0]
  const last = timeline.at(-1)
  const labels = haversineKm(first, last) < 0.5
    ? [{ key: 'start', index: 0, text: `Start ${formatDegrees(first.tempC)} · finish ${formatDegrees(last.tempC)}` }]
    : [
        { key: 'start', index: 0, text: `Start ${formatDegrees(first.tempC)}` },
        { key: 'finish', index: timeline.length - 1, text: `Finish ${formatDegrees(last.tempC)}` },
      ]
  // Extremes right at the start or finish are already in those labels.
  const nearEnds = (i) => timeline[i].km < 0.05 * last.km || timeline[i].km > 0.95 * last.km
  const extreme = (key, title, index) => ({ key, index, text: `${title} ${formatDegrees(timeline[index].tempC)} · km ${Math.round(timeline[index].km)}` })
  if (!nearEnds(summary.coldestIndex)) labels.push(extreme('coldest', 'Coldest', summary.coldestIndex))
  if (!nearEnds(summary.warmestIndex)) labels.push(extreme('warmest', 'Warmest', summary.warmestIndex))
  return labels.map((label) => ({
    ...label,
    pathOptions: { color: '#ffffff', weight: 2, fillOpacity: 1, fillColor: label.key === 'start' ? '#0b0b0b' : temperatureColor(timeline[label.index].tempC) },
  }))
}
