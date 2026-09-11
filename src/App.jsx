/*
  File: src/App.jsx
  Purpose: Main application container wiring together data flow and UI.
  What it does:
  - Manages app state: uploaded routes, start time, average speed, per-route analysis, selection, loading & errors.
  - Parses GPX uploads, then analyzes every route (forecast at each point for the time you get there → score).
    Changing the start time, speed, or weather provider re-runs the analysis after a short pause, and a newer
    run cancels the one in flight, so a slow, stale response can never overwrite a fresh one.
  - Presents the UI: ride settings, file upload, ranked route list, and the selected route's temperature detail.
  - Opens modals for Settings (optional Visual Crossing key) and Help (scoring explanation).
  Key collaborators: `gpxParser`, `routeAnalysis`, `cache`, `logger`, and UI components.
*/
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import UploadForm from './components/UploadForm.jsx'
import RouteList from './components/RouteList.jsx'
import RouteDetail from './components/RouteDetail.jsx'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'
import { parseGpxFile } from './services/gpxParser'
import { analyzeRoute } from './services/routeAnalysis'
import { getStoredApiKey, setStoredApiKey } from './services/cache'
import { logEvent } from './services/logger'
import { MAX_DAYS_AHEAD } from './services/weatherClient'

const DEFAULT_SPEED_KPH = 22
const RECALC_DELAY_MS = 350

// Tomorrow at this hour, formatted for <input type="datetime-local"> in local time.
function defaultStartDateTime() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function App() {
  const [apiKey, setApiKey] = useState(getStoredApiKey)
  const [keyDraft, setKeyDraft] = useState('')
  const [routes, setRoutes] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [startDateTime, setStartDateTime] = useState(defaultStartDateTime)
  const [speedKph, setSpeedKph] = useState(DEFAULT_SPEED_KPH)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const startMs = useMemo(() => new Date(startDateTime).getTime(), [startDateTime])

  async function handleFiles(files) {
    setUploadError('')
    const results = await Promise.allSettled(files.map(parseGpxFile))
    const parsed = []
    const failed = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') parsed.push({ id: `${Date.now()}-${i}`, name: files[i].name, ...result.value })
      else failed.push(`${files[i].name} (${result.reason?.message || 'unreadable file'})`)
    })
    if (failed.length) setUploadError(`Couldn't read ${failed.join(', ')}.`)
    if (parsed.length) {
      setRoutes(parsed)
      setAnalyses({})
      setSelectedId(null)
    }
  }

  useEffect(() => {
    if (!routes.length || !Number.isFinite(startMs)) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError('')
      try {
        const results = await Promise.all(routes.map((route) => analyzeRoute(route, { startMs, speedKph, apiKey, signal: controller.signal })))
        if (controller.signal.aborted) return
        setAnalyses(Object.fromEntries(routes.map((route, i) => [route.id, results[i]])))
        results.forEach(({ score, breakdown, summary }, i) => {
          logEvent({ type: 'route:weather', route: routes[i].name, summary: { score, breakdown, avgWindKph: summary.avgWindKph, avgHeadwindKph: summary.avgHeadwindKph } })
        })
      } catch (e) {
        if (controller.signal.aborted) return
        setAnalyses({})
        setError(e?.message || 'Could not load the forecast.')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, RECALC_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [routes, startMs, speedKph, apiKey])

  const rankedRoutes = useMemo(
    () => routes
      .map((route) => ({ ...route, analysis: analyses[route.id] }))
      .sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1)),
    [routes, analyses],
  )
  const selected = rankedRoutes.find((route) => route.id === selectedId) ?? rankedRoutes[0]

  function openSettings() {
    setKeyDraft(apiKey)
    setIsSettingsOpen(true)
  }

  function saveSettings() {
    const key = keyDraft.trim()
    setStoredApiKey(key)
    setApiKey(key)
    setIsSettingsOpen(false)
  }

  return (
    <div>
      <TopNav onOpenSettings={openSettings} onOpenHelp={() => setIsHelpOpen(true)} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <label className="block text-sm font-medium">
              Start date & time
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="mt-1 block w-full max-w-xs px-3 py-2 border rounded-md font-normal focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-sm font-medium">
              Average speed: {speedKph} km/h
              <input
                type="range"
                min="12"
                max="40"
                step="1"
                value={speedKph}
                onChange={(e) => setSpeedKph(Number(e.target.value))}
                className="mt-3 block w-56 accent-blue-600"
              />
            </label>
          </div>
          <p className="text-sm text-gray-700 mt-3">Upload GPX routes to compare weather-based comfort scores. Each point gets the forecast for when you'll reach it, based on your start time and average speed (slower on climbs, faster downhill).</p>
          <p className="text-xs text-gray-600 mt-1">Default start is 24 hours from now. Forecasts reach up to {MAX_DAYS_AHEAD} days ahead.</p>
        </div>

        <UploadForm onFiles={handleFiles} />

        {uploadError && <p className="text-red-600 mt-3" role="alert">{uploadError}</p>}
        {error && <p className="text-red-600 mt-3" role="alert">{error}</p>}
        <p className="mt-3 text-gray-700" aria-live="polite">{isLoading ? 'Loading forecasts…' : ''}</p>

        <div className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <RouteList routes={rankedRoutes} selectedId={selected?.id} onSelect={setSelectedId} isLoading={isLoading} />
          {selected?.analysis && <RouteDetail key={selected.id} route={selected} />}
        </div>
      </main>

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
              onClick={saveSettings}
            >Save</button>
          </>
        )}
      >
        <p>Forecasts come from <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, which is free and needs no key.</p>
        <form onSubmit={(e) => { e.preventDefault(); saveSettings() }}>
          <label className="block text-sm font-medium">
            Visual Crossing API key (optional)
            <input
              type="password"
              autoComplete="off"
              placeholder="Leave empty to use Open-Meteo"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md font-normal focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </form>
        <p className="text-xs text-gray-600">With a key, the app uses Visual Crossing instead. The key is stored only in this browser.</p>
      </Modal>

      <Modal
        title="Help: How scoring works"
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        footer={(
          <button className="px-3 py-1.5 text-sm rounded-md border" onClick={() => setIsHelpOpen(false)}>Close</button>
        )}
      >
        <p>Each route gets a score from 1 to 10. Higher is better. The weather at every point is the forecast for the time you'll get there.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Wind</b>: Average wind over 15 km/h costs 1.5 points (2.5 over 25, 3 over 35, 4 over 45). If it's mostly in your face, that grows up to ×1.8. A steady tailwind gives up to +1.5. Gusts over 40 km/h cost 1 more point, over 55 km/h 2 more.</li>
          <li><b>Temperature</b>: Uses the feels-like temperature, which already accounts for humidity and wind chill. 15–22°C is ideal. Below 15 costs 1 point (2 under 10, 3 under 5); above 22 costs 1 (2 over 30, 3 over 35). Every km of the ride counts. Feeling above 40°C on average is a no‑go.</li>
          <li><b>Rain</b>: The highest chance of rain during the ride. 15% or more costs 1 point, 30% costs 2, 50% costs 3, 70% costs 4.</li>
          <li><b>Visibility</b>: Below 10 km costs 1 point, below 5 km 2 points, below 2 km 3 points.</li>
        </ul>
        <p className="text-xs text-gray-600">Forecasts are sampled about every 5 km. Headwind is worked out for each stretch of road, so loops and out-and-back rides are judged fairly.</p>
      </Modal>
    </div>
  )
}

export default App
