import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logEvent } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('writes each entry to the console under its category', () => {
    logEvent({ type: 'weather:fetch', provider: 'Open-Meteo', status: 200 })
    logEvent({ type: 'something-else' })
    expect(console.info).toHaveBeenCalledWith('[weather:fetch]', expect.objectContaining({ provider: 'Open-Meteo', status: 200 }))
    expect(console.log).toHaveBeenCalledWith('[log]', expect.objectContaining({ type: 'something-else' }))
  })
})
