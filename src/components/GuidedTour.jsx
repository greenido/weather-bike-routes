/*
  File: src/components/GuidedTour.jsx
  Purpose: Guided tour (react-joyride) that shows first-time users what the app does and how to use it.
  What it does:
  - First visit: a welcome, then the ride settings, the upload area, Settings, and Help.
  - The first time a route is scored: the best route's card, the tips, the temperature map, and the chart. This
    part only runs if the first part was finished, so skipping the tour stops it for good.
  - Help can replay it (`replayRequested`; `onReplayDone` when it ends), including the route steps once a route
    is scored. Esc or "Skip tour" ends a tour, and focus returns to where it was before the tour.
  - Accessibility (focus trap, keyboard, ARIA) comes from react-joyride; each tooltip is an alertdialog.
  Notes:
  - Progress is kept in localStorage; steps point at `data-tour` attributes in the page.
  - react-joyride is loaded only when a tour runs, so returning visitors never download it.
*/
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { MAX_DAYS_AHEAD } from '../services/weatherClient'

const Joyride = lazy(() => import('react-joyride').then((module) => ({ default: module.Joyride })))

export const TOUR_STORAGE_KEY = 'bikeRouteWeather.tour'

const SETUP_STEPS = [
  {
    target: 'body',
    placement: 'center',
    title: 'Welcome to Bike Route Weather',
    content: 'Find the route with the best weather for your ride. The app works out when you’ll reach each point of each route, checks the forecast for that time and place, and scores every route from 1 to 10.',
  },
  {
    target: '[data-tour="start-time"]',
    title: 'When you set off',
    content: `Set the day and time you’ll start. Forecasts reach up to ${MAX_DAYS_AHEAD} days ahead.`,
  },
  {
    target: '[data-tour="speed"]',
    title: 'How fast you ride',
    content: 'Your average speed sets when you’ll reach each point. The app expects you to slow down on climbs and speed up downhill.',
  },
  {
    target: '[data-tour="upload"]',
    title: 'Add your routes',
    content: 'Drop one or more GPX files here, or choose them. Add a few to compare them. The files are read in your browser and never uploaded.',
  },
]

const RESULTS_STEPS = [
  {
    target: '[data-tour="routes"] > li:first-child',
    title: 'Best route first',
    content: 'Routes are ranked by their score out of 10. Each card shows what cost points (wind, temperature, rain, visibility) and sums up the ride. Select a card to see its details.',
  },
  {
    target: '[data-tour="tips"]',
    title: 'What to wear or bring',
    content: 'Tips from the forecast along the route, like arm warmers for a cold start, extra water for the heat, or a rain jacket.',
  },
  {
    target: '[data-tour="map"]',
    title: 'Temperature along the route',
    content: 'The route is colored by the temperature when you’ll get to each point: blue is colder, gray is the comfortable 15–22°C, red is warmer. Arrows show your direction; labels mark the start, finish, coldest, and warmest spots.',
  },
  {
    target: '[data-tour="profile"]',
    title: 'Every point of the ride',
    content: 'Move along the chart, or along the route on the map, to see the temperature, wind, and chance of rain at that spot and when you’ll get there. With a keyboard, focus the chart and use the arrow keys.',
  },
]

// The top bar is sticky: don't scroll to it, and don't let a click open a dialog under the tour.
const NAV_STEP = { isFixed: true, blockTargetInteraction: true }
const NAV_STEPS = [
  {
    ...NAV_STEP,
    target: '[data-tour="settings"]',
    title: 'Where the forecast comes from',
    content: 'Open-Meteo, which is free and needs no key. If you have a Visual Crossing key, add it in Settings to use that instead.',
  },
  {
    ...NAV_STEP,
    target: '[data-tour="help"]',
    title: 'Help, any time',
    content: 'How the score works, what the colors mean, and this tour again.',
  },
]

const INTRO_STEPS = [...SETUP_STEPS, ...NAV_STEPS]
const FULL_STEPS = [...SETUP_STEPS, ...RESULTS_STEPS, ...NAV_STEPS]

const OPTIONS = {
  buttons: ['back', 'skip', 'primary'],
  dismissKeyAction: false, // Esc skips the whole tour instead (see Tour).
  overlayClickAction: false,
  overlayColor: 'rgba(15, 23, 42, 0.45)',
  primaryColor: '#2563eb',
  scrollOffset: 80, // Clears the sticky top bar.
  showProgress: true,
  skipBeacon: true,
  spotlightRadius: 12,
  textColor: '#1f2937',
  width: 360,
}

const LOCALE = { last: 'Done', skip: 'Skip tour' }

const STYLES = {
  tooltip: { borderRadius: 12, padding: 16 },
  tooltipContainer: { lineHeight: 1.5, textAlign: 'left' },
  tooltipTitle: { fontSize: 17, fontWeight: 600 },
  tooltipContent: { fontSize: 14, padding: '8px 0 12px' },
  buttonPrimary: { borderRadius: 6, fontSize: 14, padding: '8px 12px' },
  buttonBack: { fontSize: 14 },
  buttonSkip: { color: '#4b5563' },
}

function readProgress() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY)
  } catch {
    return 'done' // Storage is blocked: better no tour than the same tour on every visit.
  }
}

function saveProgress(value) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, value)
  } catch {
    // Storage is blocked; nothing to remember it in.
  }
}

export default function GuidedTour({ hasResults, replayRequested, onReplayDone }) {
  const [progress, setProgress] = useState(readProgress) // null (first visit) | 'intro-done' | 'done'

  let run = null
  if (replayRequested) run = { key: 'replay', steps: hasResults ? FULL_STEPS : INTRO_STEPS }
  else if (progress === null) run = { key: 'intro', steps: INTRO_STEPS }
  else if (progress === 'intro-done' && hasResults) run = { key: 'results', steps: RESULTS_STEPS }
  if (!run) return null

  // Finishing a tour without the route steps leaves those for the first scored route.
  function handleEnd(finished, steps) {
    const next = finished && steps === INTRO_STEPS ? 'intro-done' : 'done'
    saveProgress(next)
    setProgress(next)
    if (replayRequested) onReplayDone?.()
  }

  return <Tour key={run.key} steps={run.steps} onEnd={handleEnd} />
}

function Tour({ steps: initialSteps, onEnd }) {
  const [steps] = useState(initialSteps) // Fixed for this run, even if routes come and go mid-tour.
  const controlsRef = useRef(null)

  // Like a dialog, Esc closes the tour. (react-joyride's focus trap returns focus to where it was.)
  useEffect(() => {
    const skipOnEscape = (e) => {
      if (e.key === 'Escape') controlsRef.current?.skip('button_skip')
    }
    document.addEventListener('keydown', skipOnEscape)
    return () => document.removeEventListener('keydown', skipOnEscape)
  }, [])

  // Event and status names are react-joyride's EVENTS.TOUR_END and STATUS.FINISHED; importing those constants
  // would pull the library into the main bundle.
  function handleEvent(data, controls) {
    controlsRef.current = controls
    if (data.type === 'tour:end') onEnd(data.status === 'finished', steps)
  }

  return (
    <Suspense fallback={null}>
      <Joyride
        run
        continuous
        scrollToFirstStep
        steps={steps}
        options={OPTIONS}
        locale={LOCALE}
        styles={STYLES}
        onEvent={handleEvent}
      />
    </Suspense>
  )
}
