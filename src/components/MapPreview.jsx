/*
  File: src/components/MapPreview.jsx
  Purpose: Leaflet map of the selected route, colored by the temperature you'll meet at each point.
  What it does:
  - Muted OpenStreetMap basemap (grayscaled with CSS, attribution shown) so the temperature colors stand out.
  - Draws a dark casing, then the route in the temperature colors (one polyline per stretch of about the same
    temperature), plus arrows showing the riding direction.
  - Labels start/finish, the coldest, and the warmest point, and puts temperature labels along the route. Which of
    those fit without crowding is worked out again at every zoom (`mapLabels`), so zooming in shows more.
  - A marker follows the hovered point (`hoverIndex`) and shows its temperature, time, and distance.
  - Reports the route point nearest the pointer through `onHover(index | null)`, looked up through a grid index
    of the route's projected points rather than by walking all of them on every mouse move.
  Notes:
  - The initial view comes from MapContainer `bounds`; the parent remounts this component per route.
  - Positions, path options, and icons are memoized: react-leaflet re-applies any prop whose reference changes, and
    the map re-renders on every hover.
*/
import { useCallback, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { bearingDeg, haversineKm } from '../services/geo'
import { colorRuns, temperatureColor, temperatureTextColor } from '../services/temperatureScale'
import { labelMarks, placeLabels } from '../services/mapLabels'
import { buildPointIndex, nearestPointWithin } from '../services/pointIndex'
import { formatDegrees, formatTime } from '../services/format'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const CASING = 'rgba(11,11,11,0.55)'
const LINE = { lineCap: 'round', lineJoin: 'round', opacity: 1 }
const CASING_OPTIONS = { ...LINE, color: CASING, weight: 10 }
const HOVER_RADIUS_PX = 24
const ARROW_COUNT = 8
const ARROW_PX = 14
// Space between temperature labels, and their estimated sizes (12px text; see `.temp-pill` and `.route-label`).
const LABEL_GAP_PX = 56
const PILL_HEIGHT_PX = 19
const pillWidth = (text) => text.length * 6 + 12
const calloutWidth = (text) => text.length * 5.8 + 12

export default function MapPreview({ timeline, summary, hoverIndex, onHover }) {
  const positions = useMemo(() => timeline.map((p) => [p.lat, p.lon]), [timeline])
  const bounds = useMemo(() => L.latLngBounds(positions), [positions])
  const runs = useMemo(() => colorRuns(timeline.map((p) => p.tempC)).map((run) => ({
    key: run.start,
    positions: positions.slice(run.start, run.end + 1),
    pathOptions: { ...LINE, color: run.color, weight: 6 },
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
      <TemperatureLabels timeline={timeline} labels={labels} arrows={arrows} />
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
        >
          <Tooltip permanent direction="top" offset={[0, -9]} className="route-hover">
            <b>{hovered.tempC.toFixed(1)}°C</b> · {formatTime(hovered.eta)} · km {hovered.km.toFixed(1)}
          </Tooltip>
        </CircleMarker>
      )}
      <HoverTracker positions={positions} onHover={onHover} />
    </MapContainer>
  )
}

// Temperature labels along the route: rounder km marks first, skipping any that would crowd another label or cover
// an arrow at this zoom.
function TemperatureLabels({ timeline, labels, arrows }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const marks = useMemo(() => labelMarks(timeline), [timeline])
  const pills = useMemo(() => {
    const at = (i) => map.project([timeline[i].lat, timeline[i].lon], zoom)
    const around = ({ x, y }, width, height) => ({ x0: x - width / 2, x1: x + width / 2, y0: y - height / 2, y1: y + height / 2 })
    const candidates = marks.map((index) => ({ index, ...around(at(index), pillWidth(formatDegrees(timeline[index].tempC)), PILL_HEIGHT_PX) }))
    // A callout's 24px tooltip ends 14px above its point (8px offset + the tip); its dot sits on the point.
    const callouts = labels.map((label) => {
      const { x, y } = at(label.index)
      const half = calloutWidth(label.text) / 2
      return { x0: x - half, x1: x + half, y0: y - 38, y1: y + 7 }
    })
    const blocked = arrows.map((arrow) => around(at(arrow.index), ARROW_PX, ARROW_PX))
    return placeLabels(candidates, { labels: callouts, blocked, gapPx: LABEL_GAP_PX }).map(({ index }) => {
      const { lat, lon, tempC } = timeline[index]
      return {
        index,
        position: [lat, lon],
        icon: L.divIcon({
          className: 'temp-pill-icon',
          html: `<span class="temp-pill" style="background:${temperatureColor(tempC)};color:${temperatureTextColor(tempC)}">${formatDegrees(tempC)}</span>`,
          iconSize: null,
        }),
      }
    })
  }, [map, zoom, marks, timeline, labels, arrows])

  return pills.map((pill) => (
    <Marker key={pill.index} position={pill.position} icon={pill.icon} interactive={false} keyboard={false} zIndexOffset={1000} />
  ))
}

function HoverTracker({ positions, onHover }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  // Projected at a fixed zoom, so the index survives panning and is rebuilt only when the zoom changes.
  const index = useMemo(
    () => buildPointIndex(positions.map((position) => map.project(position, zoom))),
    [map, positions, zoom],
  )
  const report = useCallback(
    (latlng) => onHover(nearestPointWithin(index, map.project(latlng, zoom), HOVER_RADIUS_PX)),
    [index, map, zoom, onHover],
  )

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    mousemove: (e) => report(e.latlng),
    mouseout: () => onHover(null),
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
          html: `<svg width="${ARROW_PX}" height="${ARROW_PX}" viewBox="-7 -7 14 14" style="transform: rotate(${rotation.toFixed(0)}deg)"><path d="M-3,-4 L2.5,0 L-3,4" fill="none" stroke="${CASING}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          iconSize: [ARROW_PX, ARROW_PX],
          iconAnchor: [ARROW_PX / 2, ARROW_PX / 2],
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
