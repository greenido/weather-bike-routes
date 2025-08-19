import ScoreBreakdown from './ScoreBreakdown.jsx'
import MapPreview from './MapPreview.jsx'

export default function RouteList({ routes, onSelect }) {
  if (!routes?.length) return null
  return (
    <div className="mt-6 space-y-4">
      {routes.map((r, idx) => (
        <div key={idx} className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition cursor-pointer" onClick={() => onSelect?.(r)}>
          <div className="flex items-center gap-4">
            <div className="w-40 h-28 rounded overflow-hidden border">
              <MapPreview path={r.path} color={r.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <h3 className="text-2xl font-semibold truncate">{r.name}</h3>
                <div className="text-3xl font-extrabold" style={{ color: r.color }}>{r.score.toFixed(1)}<span className="text-gray-400 text-xl">/10</span></div>
              </div>
              <div className="text-gray-600 mt-1">
                <ScoreBreakdown breakdown={r.breakdown} />
              </div>
              <div className="text-gray-700 mt-2 text-sm">{r.conditionsText}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}


