/*
  File: src/components/RouteDetail.jsx
  Purpose: Detail view for the selected route: the temperature you'll meet along the ride, on a map and a chart.
  What it does:
  - Summary cards (temperature range, coldest and warmest point, share of the ride in the comfort band)
    and short "what to wear or bring" advice.
  - A note when the ride is far enough out that the forecast will still move before you set off.
  - Temperature legend, the colored route map, and the distance profile. Pointing at either the map or the
    chart highlights the same spot in both (shared `hoverIndex`).
  - `data-tour` attributes mark what the guided tour points at; Help reuses `TemperatureLegend`.
*/
import { useState } from 'react'
import { Shirt } from 'lucide-react'
import MapPreview from './MapPreview.jsx'
import RouteProfile from './RouteProfile.jsx'
import { forecastLeadDays, rideAdvice, UNCERTAIN_AFTER_DAYS } from '../services/routeAnalysis'
import { COMFORT_MAX_C, COMFORT_MIN_C, TEMP_STOPS } from '../services/temperatureScale'
import { formatTime } from '../services/format'

const LEGEND_MIN_C = TEMP_STOPS[0][0]
const LEGEND_MAX_C = TEMP_STOPS.at(-1)[0]
const LEGEND_TICKS_C = [0, 5, 10, 15, 20, 25, 30, 35]
const legendPct = (tempC) => ((tempC - LEGEND_MIN_C) / (LEGEND_MAX_C - LEGEND_MIN_C)) * 100
const LEGEND_GRADIENT = `linear-gradient(to right, ${TEMP_STOPS.map(([t, color]) => `${color} ${legendPct(t)}%`).join(', ')})`

export default function RouteDetail({ route }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const { timeline, summary } = route.analysis
  const coldest = timeline[summary.coldestIndex]
  const warmest = timeline[summary.warmestIndex]
  const where = (p) => `km ${Math.round(p.km)} · ${formatTime(p.eta)}`
  const leadDays = forecastLeadDays(summary.startMs)

  return (
    <section className="mt-8" aria-labelledby="route-detail-title">
      <h3 id="route-detail-title" className="text-2xl font-semibold">{route.name}</h3>
      <p className="text-sm text-gray-600 mt-1">
        {Math.round(route.totalKm)} km · start {formatTime(summary.startMs)} · back around {formatTime(summary.endMs)}
      </p>
      {leadDays >= UNCERTAIN_AFTER_DAYS && (
        <p className="text-sm text-gray-500 mt-1">
          This ride is {leadDays} days out, so the forecast — and the score — will still move before you set off.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat label="Temperature range" value={`${Math.round(coldest.tempC)}–${Math.round(warmest.tempC)}°C`} detail={`over ${Math.round(route.totalKm)} km`} />
        <Stat label="Coldest" value={`${Math.round(coldest.tempC)}°C`} detail={where(coldest)} />
        <Stat label="Warmest" value={`${Math.round(warmest.tempC)}°C`} detail={where(warmest)} />
        <Stat label="In comfort band" value={`${Math.round(summary.comfortShare * 100)}%`} detail="of the ride at 15–22°C" />
      </div>

      <ul className="mt-4 space-y-1 text-sm text-gray-700" data-tour="tips">
        {rideAdvice(timeline, summary, formatTime).map((tip) => (
          <li key={tip} className="flex gap-2">
            <Shirt size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gray-500" />
            {tip}
          </li>
        ))}
      </ul>

      <div className="mt-5 mb-2 flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm text-gray-700">Temperature when you reach each point (°C)</span>
        <TemperatureLegend />
      </div>
      {/* `isolate` keeps Leaflet's layers (z-index 400–1000) under the sticky top bar and the tour. */}
      <div className="h-96 rounded-xl overflow-hidden border isolate" data-tour="map">
        <MapPreview timeline={timeline} summary={summary} hoverIndex={hoverIndex} onHover={setHoverIndex} />
      </div>
      <div className="mt-4 rounded-xl border bg-white p-3" data-tour="profile">
        <RouteProfile timeline={timeline} sampleIdx={route.sampleIdx} hoverIndex={hoverIndex} onHover={setHoverIndex} />
      </div>
    </section>
  )
}

function Stat({ label, value, detail }) {
  return (
    <div className="rounded-lg bg-white border px-3 py-2">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-gray-500">{detail}</div>
    </div>
  )
}

// The color scale with °C ticks, and a bracket over the comfort band.
export function TemperatureLegend() {
  return (
    <div
      role="img"
      aria-label={`Temperature colors: violet and blue when it's cold, turquoise to green for the ${COMFORT_MIN_C}–${COMFORT_MAX_C}°C comfort band, then yellow, orange, and red as it gets hotter.`}
      className="w-72 max-w-full text-[11px] leading-4 text-gray-500"
    >
      <div className="relative h-5">
        <span className="absolute top-0 -translate-x-1/2 font-medium text-gray-800" style={{ left: `${legendPct((COMFORT_MIN_C + COMFORT_MAX_C) / 2)}%` }}>comfort</span>
        <span
          className="absolute bottom-0 h-1 border-x border-t border-gray-500"
          style={{ left: `${legendPct(COMFORT_MIN_C)}%`, width: `${legendPct(COMFORT_MAX_C) - legendPct(COMFORT_MIN_C)}%` }}
        />
      </div>
      <div className="h-2 rounded-full" style={{ background: LEGEND_GRADIENT }} />
      <div className="relative h-4 mt-0.5 tabular-nums">
        {LEGEND_TICKS_C.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${legendPct(t)}%` }}>{t}°</span>
        ))}
      </div>
    </div>
  )
}
