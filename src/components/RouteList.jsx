/*
  File: src/components/RouteList.jsx
  Purpose: Displays scored routes with quick stats and a small temperature-colored sketch of each route.
  What it does:
  - Lists each route with name, score, penalty breakdown, and a one-line ride summary.
  - Each card is a real <button> (keyboard and screen-reader friendly) that selects the route via `onSelect`.
    Its accessible name is just the route and score; the breakdown and summary are its description.
  - On phones the breakdown and summary drop below the sketch and use the full card width.
*/
import ScoreBreakdown from './ScoreBreakdown.jsx'
import RouteThumbnail from './RouteThumbnail.jsx'
import { colorForScore } from '../services/scoringEngine'
import { formatTime } from '../services/format'

export default function RouteList({ routes, selectedId, onSelect, isLoading }) {
  if (!routes?.length) return null
  return (
    <ul className="mt-6 space-y-4" aria-label="Routes, best score first" data-tour="routes">
      {routes.map((route) => {
        const { analysis } = route
        const selected = route.id === selectedId
        const breakdownId = `route-breakdown-${route.id}`
        const summaryId = `route-summary-${route.id}`
        return (
          <li key={route.id}>
            <button
              type="button"
              onClick={() => onSelect?.(route.id)}
              aria-pressed={selected}
              aria-label={cardLabel(route, analysis, isLoading)}
              aria-describedby={analysis ? `${breakdownId} ${summaryId}` : summaryId}
              className={`w-full text-left bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${selected ? 'ring-2 ring-blue-600' : ''}`}
            >
              <span className="grid grid-cols-[6rem_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)] items-center gap-x-3 sm:gap-x-4 gap-y-2">
                <span className="block aspect-[10/7] rounded overflow-hidden border">
                  <RouteThumbnail points={route.points} timeline={analysis?.timeline} />
                </span>
                <span className="contents sm:block">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 text-xl sm:text-2xl font-semibold break-words line-clamp-2">{route.name}</span>
                    {analysis ? (
                      <span className="text-2xl sm:text-3xl font-extrabold shrink-0" style={{ color: colorForScore(analysis.score) }}>
                        {analysis.score.toFixed(1)}<span className="text-gray-400 text-base sm:text-xl">/10</span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 shrink-0">{isLoading ? 'Loading…' : 'No forecast'}</span>
                    )}
                  </span>
                  {analysis && (
                    <span id={breakdownId} className="col-span-2 block text-gray-600 sm:mt-1">
                      <ScoreBreakdown breakdown={analysis.breakdown} />
                    </span>
                  )}
                  <span id={summaryId} className="col-span-2 block text-gray-700 sm:mt-2 text-sm">{describeRide(route, analysis)}</span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function cardLabel(route, analysis, isLoading) {
  if (analysis) return `${route.name}, score ${analysis.score.toFixed(1)} out of 10`
  return `${route.name}, ${isLoading ? 'loading forecast' : 'no forecast'}`
}

function describeRide(route, analysis) {
  const parts = [`${Math.round(route.totalKm)} km`]
  if (analysis) {
    const { summary, timeline } = analysis
    const headwind = summary.avgHeadwindKph
    const windSide = Math.abs(headwind) >= 3 ? ` (${Math.round(Math.abs(headwind))} km/h ${headwind > 0 ? 'headwind' : 'tailwind'})` : ''
    parts.push(
      `${Math.round(timeline[summary.coldestIndex].tempC)}–${Math.round(timeline[summary.warmestIndex].tempC)}°C`,
      `wind ${Math.round(summary.avgWindKph)} km/h${windSide}`,
      `rain ${Math.round(summary.maxRainChance)}%`,
      `back ${formatTime(summary.endMs)}`,
    )
  }
  return parts.join(' • ')
}
