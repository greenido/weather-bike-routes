import { describe, expect, it } from 'vitest'
import { FORECAST_TTL_MS, getCachedForecast, isFresh, setCachedForecast } from './cache'

describe('isFresh', () => {
  const now = 1_000_000_000_000

  it('accepts entries younger than the TTL', () => {
    expect(isFresh({ cachedAt: now - FORECAST_TTL_MS + 1 }, now)).toBe(true)
  })

  it('rejects expired or missing entries', () => {
    expect(isFresh({ cachedAt: now - FORECAST_TTL_MS }, now)).toBe(false)
    expect(isFresh(undefined, now)).toBe(false)
  })
})

describe('forecast cache without IndexedDB', () => {
  it('degrades to a no-op instead of throwing', async () => {
    await expect(setCachedForecast('k', { times: [] })).resolves.toBeUndefined()
    await expect(getCachedForecast('k')).resolves.toBeUndefined()
  })
})
