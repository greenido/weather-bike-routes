/*
  File: src/App.jsx
  Purpose: Main application container wiring together data flow and UI.
  What it does:
  - Manages app state: uploaded routes, start time, moving speed, time stopped, per-route analysis, selection,
    loading & errors.
    The start time and speed can arrive from a Weather 4 Bike link (`initialSettings`).
  - Keeps a library of routes: an upload adds to what's there (re-uploading a route replaces it), each route can
    be removed on its own, and the library is stored in IndexedDB so a reload picks up where you left off.
  - Parses GPX uploads, then analyzes every route (forecast at each point for the time you get there → score).
    Changing the start time, speed, or weather provider re-runs the analysis after a short pause, and a newer
    run cancels the one in flight, so a slow, stale response can never overwrite a fresh one.
  - Presents the UI: ride settings, file upload, ranked route list, and the selected route's temperature detail.
  - Opens modals for Settings (optional Visual Crossing key) and Help, which can replay the guided tour that
    first-time users see (`GuidedTour`).
  Key collaborators: `gpxParser`, `routeAnalysis`, `cache`, `logger`, and UI components.
*/
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import UploadForm from './components/UploadForm.jsx'
import RouteList from './components/RouteList.jsx'
import RouteDetail from './components/RouteDetail.jsx'
import TopNav from './components/TopNav.jsx'
import Modal from './components/Modal.jsx'
import HelpContent from './components/HelpContent.jsx'
import GuidedTour from './components/GuidedTour.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { parseGpxFile } from './services/gpxParser'
import { analyzeRoute } from './services/routeAnalysis'
import { getStoredApiKey, getStoredRoutes, setStoredApiKey, setStoredRoutes } from './services/cache'
import { logEvent } from './services/logger'
import { MAX_DAYS_AHEAD } from './services/weatherClient'
import { MAX_SPEED_KPH, MIN_SPEED_KPH, readInitialSettings } from './services/initialSettings'

const RECALC_DELAY_MS = 350
const MINUTE_MS = 60 * 1000
// Long enough for a café stop on an all-day ride; 0 keeps the old "you never stop" estimate.
const STOP_CHOICES_MIN = [0, 10, 20, 30, 45, 60, 90]

let routeCounter = 0
// Unique across a session and across reloads, so restored routes can't collide with newly uploaded ones.
const nextRouteId = () => `${Date.now().toString(36)}-${routeCounter++}`

// The same route uploaded again (an edited file, say) replaces the one already there instead of doubling up.
const isSameRoute = (a, b) => a.name === b.name && Math.abs(a.totalKm - b.totalKm) < 0.01

const withoutExtension = (fileName) => fileName.replace(/\.gpx$/i, '')

function App() {
  const [initial] = useState(readInitialSettings)
  const [apiKey, setApiKey] = useState(getStoredApiKey)
  const [keyDraft, setKeyDraft] = useState('')
  const [routes, setRoutes] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [startDateTime, setStartDateTime] = useState(initial.startDateTime)
  const [speedKph, setSpeedKph] = useState(initial.speedKph)
  const [stopMinutes, setStopMinutes] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isTourReplay, setIsTourReplay] = useState(false)
  const [isRestored, setIsRestored] = useState(false)

  const startMs = useMemo(() => new Date(startDateTime).getTime(), [startDateTime])

  async function handleFiles(files) {
    setUploadError('')
    const results = await Promise.allSettled(files.map(parseGpxFile))
    const parsed = []
    const failed = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        // The route's own <name> beats the file name, which is often an export timestamp.
        parsed.push({ ...result.value, id: nextRouteId(), name: result.value.name || withoutExtension(files[i].name) })
      } else {
        failed.push(`${files[i].name} (${result.reason?.message || 'unreadable file'})`)
      }
    })
    if (failed.length) setUploadError(`Couldn't read ${failed.join(', ')}.`)
    if (parsed.length) setRoutes((current) => addRoutes(current, parsed))
  }

  function removeRoute(id) {
    setRoutes((current) => current.filter((route) => route.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }

  // Restore the library first, then keep it in step. Saving waits for the restore so an empty first render
  // can't overwrite what's stored.
  useEffect(() => {
    let cancelled = false
    getStoredRoutes().then((saved) => {
      if (cancelled) return
      if (saved.length) setRoutes(saved)
      setIsRestored(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isRestored) setStoredRoutes(routes)
  }, [routes, isRestored])

  useEffect(() => {
    if (!routes.length || !Number.isFinite(startMs)) {
      setIsLoading(false)
      return undefined
    }
    // Set before the debounce, not inside it, so the cards don't read "No forecast" for a third of a second.
    setIsLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setError('')
      try {
        const results = await Promise.all(routes.map((route) => analyzeRoute(route, {
          startMs, speedKph, stoppedMs: stopMinutes * MINUTE_MS, apiKey, signal: controller.signal,
        })))
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
  }, [routes, startMs, speedKph, stopMinutes, apiKey])

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

  function takeTour() {
    setIsHelpOpen(false)
    setIsTourReplay(true)
  }

  return (
    <div className="text-gray-900 dark:text-slate-200">
      <TopNav onOpenSettings={openSettings} onOpenHelp={() => setIsHelpOpen(true)} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <label className="block text-sm font-medium" data-tour="start-time">
              Start date & time
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="mt-1 block w-full max-w-xs px-3 py-2 border dark:border-slate-700 rounded-md font-normal bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block text-sm font-medium" data-tour="speed">
              Average speed: {speedKph} km/h
              <input
                type="range"
                min={MIN_SPEED_KPH}
                max={MAX_SPEED_KPH}
                step="1"
                value={speedKph}
                onChange={(e) => setSpeedKph(Number(e.target.value))}
                className="mt-3 block w-56 accent-blue-600"
              />
            </label>
            <label className="block text-sm font-medium">
              Time stopped
              <select
                value={stopMinutes}
                onChange={(e) => setStopMinutes(Number(e.target.value))}
                className="mt-1 block px-3 py-2 border dark:border-slate-700 rounded-md font-normal bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              >
                {STOP_CHOICES_MIN.map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes === 0 ? 'No stops' : `${minutes} min`}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-3">Upload GPX routes to compare weather-based comfort scores. Each point gets the forecast for when you'll reach it, based on your start time and your speed while moving (slower on climbs, faster downhill), plus any time you expect to spend stopped.</p>
          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Default start is 24 hours from now. Forecasts reach up to {MAX_DAYS_AHEAD} days ahead.</p>
        </div>

        <div data-tour="upload">
          <UploadForm onFiles={handleFiles} />
        </div>

        {uploadError && <p className="text-red-600 dark:text-red-400 mt-3" role="alert">{uploadError}</p>}
        {error && <p className="text-red-600 dark:text-red-400 mt-3" role="alert">{error}</p>}
        <p className="mt-3 text-gray-700 dark:text-slate-300" aria-live="polite">{isLoading ? 'Loading forecasts…' : ''}</p>

        <div className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <RouteList routes={rankedRoutes} selectedId={selected?.id} onSelect={setSelectedId} onRemove={removeRoute} isLoading={isLoading} />
          {selected?.analysis && (
            <ErrorBoundary label="route detail" resetKey={selected.id}>
              <RouteDetail key={selected.id} route={selected} />
            </ErrorBoundary>
          )}
        </div>
      </main>

      <Modal
        title="Settings"
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        footer={(
          <>
            <button
              className="px-3 py-1.5 text-sm rounded-md border dark:border-slate-700"
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
              className="mt-1 w-full px-3 py-2 border dark:border-slate-700 rounded-md font-normal bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </form>
        <p className="text-xs text-gray-600 dark:text-slate-400">With a key, the app uses Visual Crossing instead. The key is stored only in this browser.</p>
      </Modal>

      <Modal
        title="Help"
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        footer={(
          <>
            <button className="px-3 py-1.5 text-sm rounded-md border dark:border-slate-700" onClick={() => setIsHelpOpen(false)}>Close</button>
            <button className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white" onClick={takeTour}>Take the tour</button>
          </>
        )}
      >
        <HelpContent />
      </Modal>

      <GuidedTour hasResults={Boolean(selected?.analysis)} replayRequested={isTourReplay} onReplayDone={() => setIsTourReplay(false)} />
    </div>
  )
}

// Newly parsed routes join the library, replacing any copy of the same route already in it.
function addRoutes(current, parsed) {
  const merged = [...current]
  parsed.forEach((route) => {
    const at = merged.findIndex((existing) => isSameRoute(existing, route))
    if (at === -1) merged.push(route)
    else merged[at] = { ...route, id: merged[at].id } // Keep the id so the selection survives a re-upload.
  })
  return merged
}

export default App
