/*
  File: src/components/RouteDetail.jsx
  Purpose: Detail view for the selected route: the temperature you'll meet along the ride, on a map and a chart.
  What it does:
  - Summary cards (temperature range, coldest and warmest point, share of the ride in the comfort band)
    and short "what to wear or bring" advice.
  - Temperature legend, the colored route map, and the distance profile. Pointing at either the map or the
    chart highlights the same spot in both (shared `hoverIndex`).
*/
import { useState } from 'react'
import { Shirt } from 'lucide-react'
import MapPreview from './MapPreview.jsx'
import RouteProfile from './RouteProfile.jsx'
import { rideAdvice } from '../services/routeAnalysis'
import { COMFORT_BIN, TEMP_COLORS, TEMP_LABELS } from '../services/temperatureScale'
import { formatTime } from '../services/format'

export default function RouteDetail({ route }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const { timeline, summary } = route.analysis
  const coldest = timeline[summary.coldestIndex]
  const warmest = timeline[summary.warmestIndex]
  const where = (p) => `km ${Math.round(p.km)} · ${formatTime(p.eta)}`

  return (
    <section className="mt-8" aria-labelledby="route-detail-title">
      <h3 id="route-detail-title" className="text-2xl font-semibold">{route.name}</h3>
      <p className="text-sm text-gray-600 mt-1">
        {Math.round(route.totalKm)} km · start {formatTime(summary.startMs)} · back around {formatTime(summary.endMs)}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat label="Temperature range" value={`${Math.round(coldest.tempC)}–${Math.round(warmest.tempC)}°C`} detail={`over ${Math.round(route.totalKm)} km`} />
        <Stat label="Coldest" value={`${Math.round(coldest.tempC)}°C`} detail={where(coldest)} />
        <Stat label="Warmest" value={`${Math.round(warmest.tempC)}°C`} detail={where(warmest)} />
        <Stat label="In comfort band" value={`${Math.round(summary.comfortShare * 100)}%`} detail="of the ride at 15–22°C" />
      </div>

      <ul className="mt-4 space-y-1 text-sm text-gray-700">
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
      <div className="h-96 rounded-xl overflow-hidden border">
        <MapPreview timeline={timeline} summary={summary} hoverIndex={hoverIndex} onHover={setHoverIndex} />
      </div>
      <div className="mt-4 rounded-xl border bg-white p-3">
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

function TemperatureLegend() {
  return (
    <ul className="flex gap-0.5 text-[11px] text-gray-500 text-center" aria-label="Temperature colors">
      {TEMP_COLORS.map((color, i) => (
        <li key={color} className={i === COMFORT_BIN ? 'text-gray-800 font-medium' : undefined}>
          <span className="block h-1.5 w-9 rounded-sm mb-0.5" style={{ background: color }} aria-hidden="true" />
          {TEMP_LABELS[i]}
        </li>
      ))}
    </ul>
  )
}
