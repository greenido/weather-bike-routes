/*
  File: src/components/TopNav.jsx
  Purpose: Sticky top navigation bar with quick access to Settings and Help.
  What it does:
  - Provides actions to open the Settings modal (API key) and Help modal (scoring details).
*/
export default function TopNav({ onOpenSettings, onOpenHelp }) {
  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="text-xl font-bold tracking-tight">🚴🏼‍♂️ Bike Route Weather</div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50"
            onClick={onOpenSettings}
          >
            Settings
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            onClick={onOpenHelp}
          >
            Help
          </button>
        </div>
      </div>
    </nav>
  )
}


