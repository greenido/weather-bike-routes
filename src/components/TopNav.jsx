/*
  File: src/components/TopNav.jsx
  Purpose: Sticky top navigation bar with quick access to Settings and Help.
  What it does:
  - Provides actions to open the Settings modal (API key) and Help modal (how to use the app, scoring, the tour).
  - Holds the light/dark switch.
  - Links back to Weather 4 Bike, the forecast app that links here to score routes for its best riding window.
*/
import ThemeToggle from './ThemeToggle.jsx'
const WEATHER_4_BIKE_URL = 'https://greenido.github.io/weather-4-bike/'

export default function TopNav({ onOpenSettings, onOpenHelp }) {
  return (
    <nav className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b dark:border-slate-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* The full name and the buttons don't both fit on a narrow phone; the short name keeps this one line. */}
        <div className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
          <span aria-hidden="true">🚴🏼‍♂️</span>
          <span className="min-[480px]:hidden"> Route Weather</span>
          <span className="hidden min-[480px]:inline"> Bike Route Weather</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {/* Just the arrow on phones, where the title needs the room. */}
          <a
            href={WEATHER_4_BIKE_URL}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Weather 4 Bike forecast"
            title="Weather 4 Bike: the forecast and best time to ride"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline"> Weather 4 Bike</span>
          </a>
          <button
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={onOpenSettings}
            data-tour="settings"
          >
            Settings
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            onClick={onOpenHelp}
            data-tour="help"
          >
            Help
          </button>
        </div>
      </div>
    </nav>
  )
}


