/*
  File: src/components/RouteProfile.jsx
  Purpose: Distance-based chart of the ride: temperature when you get there (colored like the map) and elevation.
  What it does:
  - Temperature line over the shaded 15–22°C comfort band; elevation gets its own small chart underneath
    (two different scales never share one axis). The x-axis shows distance and the time you'll be there.
  - Crosshair and tooltip on hover or touch; arrow keys step through the ride 1 km at a time. The hovered point
    is shared with the map through `hoverIndex` / `onHover`.
  - "Show forecast points as a table" lists the sampled forecasts with exact values.
  Notes:
  - The SVG is drawn at the container's pixel width (ResizeObserver) so labels stay 12px on any screen.
  - The title row is HTML so it wraps on phones; the tooltip is measured and kept inside the chart.
*/
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COMFORT_MAX_C, COMFORT_MIN_C, TEMP_COLORS, colorRuns, temperatureColor } from '../services/temperatureScale'
import { compassPoint, formatTime } from '../services/format'

const X0 = 52
const RIGHT_PAD = 14
const T_TOP = 12
const T_BOTTOM = 132
const E_TOP = 168
const E_BOTTOM = 214
const TOOLTIP_GAP = 12
const TOOLTIP_TOP = 4
const ELEVATION_GRAY = '#888780'
const MIN_TICK_PX = 84
const KM_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200]

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))

export default function RouteProfile({ timeline, sampleIdx, hoverIndex, onHover }) {
  const wrapRef = useRef(null)
  const tooltipRef = useRef(null)
  const width = useElementWidth(wrapRef)
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 })
  const chart = useMemo(() => buildChart(timeline, width), [timeline, width])
  const { xOf, yT, yE, axisY, height, hasElevation } = chart
  const hovered = hoverIndex == null ? null : timeline[hoverIndex]
  const hoverX = hovered ? xOf(hovered.km) : 0

  useLayoutEffect(() => {
    const tip = tooltipRef.current
    if (tip) setTooltipSize({ width: tip.offsetWidth, height: tip.offsetHeight })
  }, [hoverIndex])

  function indexAt(clientX) {
    const rect = wrapRef.current.getBoundingClientRect()
    return nearestIndex(timeline, chart.kmAt(clientX - rect.left))
  }

  function handleKeyDown(e) {
    const last = timeline.length - 1
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      onHover(e.key === 'Home' ? 0 : last)
      return
    }
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const current = hoverIndex ?? 0
    let next = nearestIndex(timeline, timeline[current].km + dir)
    if (next === current) next = clamp(current + dir, 0, last)
    onHover(next)
  }

  const coldest = Math.min(...timeline.map((p) => p.tempC))
  const warmest = Math.max(...timeline.map((p) => p.tempC))

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs" style={{ paddingLeft: X0, paddingRight: RIGHT_PAD }}>
        <span className="text-gray-700">Temperature when you get there</span>
        <span className="inline-flex items-center gap-1.5 text-gray-500">
          <span className="inline-block h-[11px] w-[14px] rounded-sm bg-black/[0.08]" aria-hidden="true" />
          Comfort {COMFORT_MIN_C}–{COMFORT_MAX_C}°C
        </span>
      </div>
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block touch-pan-y select-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          role="img"
          aria-label={`Temperature along the ride, from ${Math.round(coldest)}°C to ${Math.round(warmest)}°C. Use the left and right arrow keys to step through it.`}
          tabIndex={0}
          onPointerMove={(e) => onHover(indexAt(e.clientX))}
          onPointerDown={(e) => onHover(indexAt(e.clientX))}
          onPointerLeave={() => onHover(null)}
          onKeyDown={handleKeyDown}
          onFocus={() => onHover(hoverIndex ?? 0)}
          onBlur={() => onHover(null)}
        >
          {chart.tempTicks.map((t) => (
            <g key={t}>
              <line x1={X0} x2={chart.x1} y1={yT(t)} y2={yT(t)} stroke="#e5e7eb" />
              <text x={X0 - 8} y={yT(t) + 4} fontSize="12" textAnchor="end" className="fill-gray-500 tabular-nums">{t}°</text>
            </g>
          ))}
          <rect x={X0} y={yT(COMFORT_MAX_C)} width={chart.x1 - X0} height={yT(COMFORT_MIN_C) - yT(COMFORT_MAX_C)} fill="rgba(11,11,11,0.05)" />
          {chart.tempRuns.map((run) => (
            <polyline key={run.key} points={run.points} fill="none" stroke={run.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {hasElevation && (
            <g>
              <text x={X0} y={E_TOP - 12} fontSize="12" className="fill-gray-700">Elevation</text>
              <line x1={X0} x2={chart.x1} y1={E_TOP} y2={E_TOP} stroke="#e5e7eb" />
              <text x={X0 - 8} y={E_TOP + 4} fontSize="12" textAnchor="end" className="fill-gray-500 tabular-nums">{chart.eleMax} m</text>
              <text x={X0 - 8} y={E_BOTTOM} fontSize="12" textAnchor="end" className="fill-gray-500 tabular-nums">{chart.eleMin} m</text>
              <path d={chart.elevationArea} fill={ELEVATION_GRAY} fillOpacity="0.14" />
              <polyline points={chart.elevationLine} fill="none" stroke={ELEVATION_GRAY} strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          )}

          <line x1={X0} x2={chart.x1} y1={axisY} y2={axisY} stroke="#d1d5db" />
          {chart.kmTicks.map(({ km, index }) => (
            <g key={km} className="tabular-nums">
              <text x={xOf(km)} y={axisY + 17} fontSize="12" textAnchor={km === 0 ? 'start' : 'middle'} className="fill-gray-700">{km === 0 ? 'Start' : `${km} km`}</text>
              <text x={xOf(km)} y={axisY + 33} fontSize="12" textAnchor={km === 0 ? 'start' : 'middle'} className="fill-gray-500">{formatTime(timeline[index].eta)}</text>
            </g>
          ))}

          {hovered && (
            <g pointerEvents="none">
              <line x1={hoverX} x2={hoverX} y1={T_TOP} y2={axisY} stroke="#4b5563" />
              <circle cx={hoverX} cy={yT(hovered.tempC)} r="5" fill={temperatureColor(hovered.tempC)} stroke="#fff" strokeWidth="2" />
              {hasElevation && <circle cx={hoverX} cy={yE(hovered.ele)} r="4.5" fill={ELEVATION_GRAY} stroke="#fff" strokeWidth="2" />}
            </g>
          )}
        </svg>

        {hovered && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-white/95 px-2.5 py-1.5 text-xs leading-5 text-gray-600 shadow-sm"
            style={tooltipPosition(hoverX, yT(hovered.tempC), tooltipSize, width)}
          >
            <div className="text-sm font-semibold text-gray-900">
              {hovered.tempC.toFixed(1)}°C <span className="font-normal text-gray-600">feels like {Math.round(hovered.feelsLikeC)}°</span>
            </div>
            <div>km {hovered.km.toFixed(1)} · {formatTime(hovered.eta)}{Number.isFinite(hovered.ele) ? ` · ${Math.round(hovered.ele)} m` : ''}</div>
            <div>Wind {Math.round(hovered.windKph)} km/h {compassPoint(hovered.windFromDeg)} · rain {Math.round(hovered.rainChance)}%</div>
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Show forecast points as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left tabular-nums">
            <thead className="text-gray-500">
              <tr>{['km', 'Time', 'Temp', 'Feels like', 'Wind', 'Gusts', 'Rain'].map((h) => <th key={h} scope="col" className="py-1 pr-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sampleIdx.map((i) => {
                const p = timeline[i]
                return (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-4">{p.km.toFixed(1)}</td>
                    <td className="py-1 pr-4">{formatTime(p.eta)}</td>
                    <td className="py-1 pr-4">{p.tempC.toFixed(1)}°C</td>
                    <td className="py-1 pr-4">{Math.round(p.feelsLikeC)}°C</td>
                    <td className="py-1 pr-4">{Math.round(p.windKph)} km/h {compassPoint(p.windFromDeg)}</td>
                    <td className="py-1 pr-4">{Math.round(p.gustKph)} km/h</td>
                    <td className="py-1 pr-4">{Math.round(p.rainChance)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function buildChart(timeline, width) {
  const totalKm = timeline.at(-1).km || 1
  const x1 = Math.max(X0 + 100, width - RIGHT_PAD)
  const xOf = (km) => X0 + (km / totalKm) * (x1 - X0)
  const temps = timeline.map((p) => p.tempC)
  const lo = Math.floor((Math.min(...temps, COMFORT_MIN_C) - 1) / 5) * 5
  const hi = Math.ceil((Math.max(...temps, COMFORT_MAX_C) + 1) / 5) * 5
  const yT = (t) => T_BOTTOM - ((t - lo) / (hi - lo)) * (T_BOTTOM - T_TOP)

  const hasElevation = timeline.every((p) => Number.isFinite(p.ele))
  const eles = hasElevation ? timeline.map((p) => p.ele) : [0]
  const eleMin = Math.floor(Math.min(...eles) / 100) * 100
  const eleMax = Math.max(eleMin + 100, Math.ceil(Math.max(...eles) / 100) * 100)
  const yE = (e) => E_BOTTOM - ((e - eleMin) / (eleMax - eleMin)) * (E_BOTTOM - E_TOP)
  const axisY = hasElevation ? E_BOTTOM : T_BOTTOM + 8

  const xy = (p, y) => `${xOf(p.km).toFixed(1)},${y.toFixed(1)}`
  const tempRuns = colorRuns(temps).map((run) => ({
    key: `${run.start}-${run.bin}`,
    color: TEMP_COLORS[run.bin],
    points: timeline.slice(run.start, run.end + 1).map((p) => xy(p, yT(p.tempC))).join(' '),
  }))
  const elevationLine = hasElevation ? timeline.map((p) => xy(p, yE(p.ele))).join(' ') : ''
  const elevationArea = hasElevation ? `M${X0},${E_BOTTOM} L${elevationLine.replaceAll(' ', ' L')} L${x1},${E_BOTTOM} Z` : ''

  const step = KM_STEPS.find((s) => (totalKm / s) * MIN_TICK_PX <= x1 - X0) ?? 500
  const kmTicks = []
  for (let km = 0; km <= totalKm - step * 0.4; km += step) kmTicks.push({ km, index: nearestIndex(timeline, km) })
  const tempTicks = []
  for (let t = lo; t <= hi; t += 5) tempTicks.push(t)

  return {
    x1, xOf, yT, yE, axisY, height: axisY + 42, hasElevation, eleMin, eleMax,
    tempRuns, elevationLine, elevationArea, kmTicks, tempTicks,
    kmAt: (px) => clamp(((px - X0) / (x1 - X0)) * totalKm, 0, totalKm),
  }
}

// Beside the crosshair when there's room (right side first). On narrow charts it's centered on the crosshair,
// above the hovered point (below it near the top), so it never hides the point.
function tooltipPosition(x, y, tip, width) {
  if (x + TOOLTIP_GAP + tip.width <= width) return { left: x + TOOLTIP_GAP, top: TOOLTIP_TOP }
  if (x - TOOLTIP_GAP - tip.width >= 0) return { left: x - TOOLTIP_GAP - tip.width, top: TOOLTIP_TOP }
  const above = y - TOOLTIP_GAP - tip.height
  return {
    left: clamp(x - tip.width / 2, 0, Math.max(0, width - tip.width)),
    top: above >= 0 ? above : y + TOOLTIP_GAP,
  }
}

function nearestIndex(timeline, km) {
  let lo = 0
  let hi = timeline.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (timeline[mid].km < km) lo = mid
    else hi = mid
  }
  return km - timeline[lo].km <= timeline[hi].km - km ? lo : hi
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
