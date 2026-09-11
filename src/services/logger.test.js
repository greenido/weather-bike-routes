import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clear, getEntries, logEvent, subscribe } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    clear()
    vi.restoreAllMocks()
  })

  it('writes each entry to the console under its category', () => {
    logEvent({ type: 'weather:fetch', provider: 'Open-Meteo', status: 200 })
    logEvent({ type: 'something-else' })
    expect(console.info).toHaveBeenCalledWith('[weather:fetch]', expect.objectContaining({ provider: 'Open-Meteo', status: 200 }))
    expect(console.log).toHaveBeenCalledWith('[log]', expect.objectContaining({ type: 'something-else' }))
  })

  it('keeps entries only while someone is listening', () => {
    logEvent({ type: 'weather:fetch' })
    expect(getEntries()).toEqual([])
    const unsubscribe = subscribe(() => {})
    logEvent({ type: 'weather:fetch' })
    unsubscribe()
    expect(getEntries()).toHaveLength(1)
  })

  it('stamps entries and hands the list to subscribers', () => {
    const seen = []
    const unsubscribe = subscribe((entries) => seen.push(entries))
    logEvent({ type: 'route:weather', route: 'loop.gpx' })
    unsubscribe()
    // First the current list on subscribe, then the list with the new entry.
    expect(seen).toHaveLength(2)
    const [entry] = seen[1]
    expect(entry).toMatchObject({ type: 'route:weather', route: 'loop.gpx', id: expect.any(String) })
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false)
  })

  it('stops notifying after unsubscribing', () => {
    const listener = vi.fn()
    subscribe(listener)()
    logEvent({ type: 'weather:fetch' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clears the list and tells subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    logEvent({ type: 'weather:fetch' })
    clear()
    unsubscribe()
    expect(getEntries()).toEqual([])
    expect(listener).toHaveBeenLastCalledWith([])
  })
})
