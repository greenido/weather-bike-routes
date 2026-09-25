/*
  File: src/components/ThemeToggle.jsx
  Purpose: The light/dark switch in the top bar.
  What it does:
  - Opens on the rider's saved choice, or their system setting when they have never chosen, and follows the
    system setting until they do.
  - Toggling writes the choice through `theme.js`, which also flips the `dark` class on <html>.
*/
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { chooseTheme, preferredTheme, watchSystemTheme } from '../services/theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(preferredTheme)
  useEffect(() => watchSystemTheme(setTheme), [])
  const isDark = theme === 'dark'

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    chooseTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className="px-3 py-1.5 rounded-md border hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  )
}
