// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseTheme, preferredTheme, THEME_STORAGE_KEY, watchSystemTheme } from './theme'

const listeners = new Set()
const matchMedia = (matches) => vi.fn(() => ({
  matches,
  addEventListener: (_, fn) => listeners.add(fn),
  removeEventListener: (_, fn) => listeners.delete(fn),
}))
const systemChangesTo = (dark) => listeners.forEach((fn) => fn({ matches: dark }))

beforeEach(() => {
  localStorage.clear()
  listeners.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => vi.unstubAllGlobals())

describe('preferredTheme', () => {
  it('follows the system setting when nothing has been chosen', () => {
    vi.stubGlobal('matchMedia', matchMedia(true))
    expect(preferredTheme()).toBe('dark')
    vi.stubGlobal('matchMedia', matchMedia(false))
    expect(preferredTheme()).toBe('light')
  })

  it('prefers a saved choice over the system setting', () => {
    vi.stubGlobal('matchMedia', matchMedia(true))
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(preferredTheme()).toBe('light')
  })

  it('ignores a stored value that is not a theme', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse')
    expect(preferredTheme()).toBe('light')
  })
})

describe('chooseTheme', () => {
  it('flips the class on <html> and remembers the choice', () => {
    chooseTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    chooseTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})

describe('watchSystemTheme', () => {
  it('follows the system while nothing has been chosen', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    const onChange = vi.fn()
    const stop = watchSystemTheme(onChange)

    systemChangesTo(true)
    expect(onChange).toHaveBeenCalledWith('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    stop()
    expect(listeners.size).toBe(0)
  })

  it('leaves a rider who has chosen alone', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const onChange = vi.fn()
    watchSystemTheme(onChange)

    systemChangesTo(true)
    expect(onChange).not.toHaveBeenCalled()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
