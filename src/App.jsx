/*
  File: src/App.jsx
  Purpose: Main application container wiring together data flow and UI.
  What it does:
  - Manages app state: API key, uploaded routes, selection, loading & errors.
  - Orchestrates GPX parsing, waypoint sampling, weather fetching/aggregation, and scoring.
  - Presents the UI: date/time selector, file upload, route list with scores, and map preview.
  - Opens modals for Settings (API key) and Help (scoring explanation).
  Key collaborators: `gpxParser`, `weatherClient`, `scoringEngine`, `cache`, `logger`, and UI components.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import UploadForm from './components/UploadForm.jsx'
import RouteList from './components/RouteList.jsx'
import MapPreview from './components/MapPreview.jsx'
import { parseGpxFile, extractWaypointsAtInterval, estimateRouteHeading } from './services/gpxParser'
import { fetchAggregatedForRoute } from './services/weatherClient'
import { calculateRouteScore, colorForScore } from './services/scoringEngine'
import { getStoredApiKey, setStoredApiKey } from './services/cache'
import { logEvent } from './services/logger'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'

function App() {
  const [apiKey, setApiKey] = useState(getStoredApiKey())
  const [routes, setRoutes] = useState([])
  const routesRef = useRef([])
  const [selected, setSelected] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const defaultStartDateTime = useMemo(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    const pad = (n) => String(n).padStart(2, '0')
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
  }, [])
  const [startDateTime, setStartDateTime] = useState(defaultStartDateTime)

  useEffect(() => {
    if (!getStoredApiKey()) {
      setIsSettingsOpen(true)
    }
  }, [])

  async function handleFiles(files) {
    setError('')
    if (!apiKey) {
      setError('Please provide your Visual Crossing API key to continue.')
      setIsSettingsOpen(true)
      return
    }
    setIsLoading(true)
    try {
      const parsed = await Promise.all(files.map(parseGpxFile))
      const routeObjs = []
      for (let i = 0; i < parsed.length; i++) {
        const gpx = parsed[i]
        const name = files[i]?.name || `Route ${i + 1}`
        const path = collectPathPoints(gpx)
        const waypoints = extractWaypointsAtInterval(gpx, 10)
        const routeHeading = estimateRouteHeading(gpx)
        const weather = await fetchAggregatedForRoute(apiKey, waypoints, startDateTime)
        if (!weather) continue

        const score = calculateRouteScore({ ...weather, routeHeading })
        const breakdown = buildBreakdown({ ...weather, routeHeading })
        const color = colorForScore(score)
        const conditionsText = `${Math.round(weather.windSpeed)} km/h • ${Math.round(weather.tempC)}°C • ${Math.round(weather.humidity)}% • ${Math.round(weather.visibilityKm)} km`
        routeObjs.push({ name, score, color, breakdown, conditionsText, path, waypoints, routeHeading })

        try {
          logEvent({ type: 'route:weather', route: name, summary: { score, color, routeHeading }, weather })
        } catch (err) {
          console.warn('Failed to log route weather event', err)
        }
      }
      routeObjs.sort((a, b) => b.score - a.score)
      setRoutes(routeObjs)
      setSelected(routeObjs[0] || null)
    } catch (e) {
      setError(e?.message || 'Failed to process files')
    } finally {
      setIsLoading(false)
    }
  }

  function collectPathPoints(gpx) {
    const tracks = gpx.tracks || []
    const points = []
    for (const track of tracks) {
      const segPoints = track.points || track?.segments?.[0]?.points || []
      for (const p of segPoints) {
        if (p.lat && p.lon) points.push({ lat: p.lat, lon: p.lon })
      }
    }
    return points
  }

  useEffect(() => {
    routesRef.current = routes
  }, [routes])

  // Recalculate existing routes when the start date/time changes
  useEffect(() => {
    if (!apiKey) return
    const existingRoutes = routesRef.current
    if (!existingRoutes.length) return
    setIsLoading(true)
    setError('')
    ;(async () => {
      try {
        const updated = await Promise.all(existingRoutes.map(async (r) => {
          if (!r?.waypoints || !r?.routeHeading) return r
          const weather = await fetchAggregatedForRoute(apiKey, r.waypoints, startDateTime)
          if (!weather) return r
          const score = calculateRouteScore({ ...weather, routeHeading: r.routeHeading })
          const breakdown = buildBreakdown({ ...weather, routeHeading: r.routeHeading })
          const color = colorForScore(score)
          const conditionsText = `${Math.round(weather.windSpeed)} km/h • ${Math.round(weather.tempC)}°C • ${Math.round(weather.humidity)}% • ${Math.round(weather.visibilityKm)} km`
          return { ...r, score, breakdown, color, conditionsText }
        }))
        updated.sort((a, b) => b.score - a.score)
        setRoutes(updated)
        setSelected(updated[0] || null)
      } catch (e) {
        setError(e?.message || 'Failed to recalculate routes for new date/time')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [startDateTime, apiKey])

  function buildBreakdown({ windSpeed, windDirection, tempC, humidity, visibilityKm, routeHeading }) {
    let windPenalty = windSpeed > 45 ? 4 : windSpeed > 35 ? 3 : windSpeed > 25 ? 2 : windSpeed > 15 ? 1 : 0
    const relative = Math.abs(windDirection - routeHeading) % 360
    if (relative < 45 || relative > 315) windPenalty *= 1.8
    else if (relative > 135 && relative < 225) windPenalty -= 1.5
    const tempPenalty = (tempC < 5) ? 3 : (tempC < 10) ? 2 : (tempC < 15) ? 1 : (tempC > 40) ? 9 : (tempC > 35) ? 3 : (tempC > 30) ? 2 : (tempC > 22) ? 1 : 0
    const humidityPenalty = humidity > 90 ? 3 : humidity > 80 ? 2 : humidity >= 68 ? 1 : 0
    const visibilityPenalty = visibilityKm < 2 ? 3 : visibilityKm < 5 ? 2 : visibilityKm < 10 ? 1 : 0
    return { windPenalty, tempPenalty, humidityPenalty, visibilityPenalty }
  }

  return (
    <div>
      <TopNav onOpenSettings={() => setIsSettingsOpen(true)} onOpenHelp={() => setIsHelpOpen(true)} />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-4">
          <label className="block text-sm font-medium">Start date & time</label>
          <input
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className="mt-1 w-full max-w-xs px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-700 mt-2">Upload GPX routes to compare weather-based comfort scores. Pick the start date/time to use the right forecast.</p>
          <p className="text-xs text-gray-600 mt-1">Default is 24 hours from now. This determines which hourly forecast is used.</p>
        </div>

        <UploadForm onFiles={handleFiles} />

        {error && <p className="text-red-600 mt-3">{error}</p>}
        {isLoading && <p className="mt-3 text-gray-700">Processing…</p>}

        <RouteList routes={routes} onSelect={setSelected} />

        {selected && (
          <div className="mt-8">
            <h3 className="text-2xl font-semibold mb-3">Map Preview: {selected.name}</h3>
            <div className="h-80 rounded-xl overflow-hidden border">
              <MapPreview path={selected.path} color={selected.color} />
            </div>
          </div>
        )}

      </div>

      <Modal
        title="Settings"
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        footer={(
          <>
            <button
              className="px-3 py-1.5 text-sm rounded-md border"
              onClick={() => setIsSettingsOpen(false)}
            >Close</button>
            <button
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white"
              onClick={() => {
                setStoredApiKey(apiKey)
                setIsSettingsOpen(false)
              }}
            >Save</button>
          </>
        )}
      >
        <label className="block text-sm font-medium">Visual Crossing API Key</label>
        <input
          type="password"
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-600">Find your key in your Visual Crossing account. We store it locally in your browser.</p>
      </Modal>

      <Modal
        title="Help: How scoring works"
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        footer={(
          <button className="px-3 py-1.5 text-sm rounded-md border" onClick={() => setIsHelpOpen(false)}>Close</button>
        )}
      >
        <p>Each route gets a score from 1 to 10. Higher is better.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Wind</b>: Up to 10 km/h no change. Over 15 km/h reduces the score. Headwinds hurt more (×1.8). Tailwinds give a +1.5 bonus.</li>
          <li><b>Temperature</b>: 15–22°C ideal. Below 15 reduces score (harsher under 5°C). Above 22 reduces score (harsher over 35°C). Above 40°C is a no‑go.</li>
          <li><b>Humidity</b>: 0–67% no penalty. ≥68% reduces score; ≥80% reduces more; ≥90% even more.</li>
          <li><b>Visibility</b>: Below 10 km reduces score; harsher penalties below 5 km and 2 km.</li>
        </ul>
        <p className="text-xs text-gray-600">We average weather along the route and adjust wind by your route heading.</p>
      </Modal>
    </div>
  )
}

export default App
