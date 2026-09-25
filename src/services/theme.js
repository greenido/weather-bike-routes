/*
  File: src/services/theme.js
  Purpose: Which theme the app shows, and remembering a rider's choice.
  What it does:
  - preferredTheme(): the saved choice, or the system setting when there isn't one.
  - chooseTheme(theme): applies it to <html> and remembers it. Only an explicit choice is stored, so a visitor
    who never touches the toggle keeps following their system setting.
  - watchSystemTheme(onChange): follows the system setting while no choice has been saved.
  Notes:
  - index.html reads the same key in an inline script before the first paint, so a dark-mode visitor never sees
    a white flash. Keep THEME_STORAGE_KEY in step with it.
*/
export const THEME_STORAGE_KEY = 'bikeRouteWeather.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function savedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'dark' || saved === 'light' ? saved : null
  } catch {
    return null // Storage can be blocked (private mode, site data off).
  }
}

function systemTheme() {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function preferredTheme() {
  return savedTheme() ?? systemTheme()
}

export function chooseTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The choice then lasts for this session only.
  }
}

export function watchSystemTheme(onChange) {
  let query
  try {
    query = window.matchMedia(DARK_QUERY)
  } catch {
    return () => {}
  }
  const handle = (e) => {
    if (savedTheme()) return // A rider's own choice wins over the system setting.
    const theme = e.matches ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    onChange(theme)
  }
  query.addEventListener('change', handle)
  return () => query.removeEventListener('change', handle)
}
