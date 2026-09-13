import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEED_KPH, SHARED_SPEED_KEY, readInitialSettings, toDateTimeLocal } from './initialSettings'

const NOW = Date.parse('2026-09-13T10:30:00Z')
const HOUR_MS = 60 * 60 * 1000
const storageWith = (items = {}) => ({ getItem: (key) => items[key] ?? null })
const read = (search, items) => readInitialSettings({ search, storage: storageWith(items), now: NOW })
// What the date input shows for an instant depends on the machine's time zone, so compare through the same helper.
const local = (iso) => toDateTimeLocal(new Date(iso))
const tomorrowOnTheHour = () => {
  const d = new Date(NOW + 24 * HOUR_MS)
  d.setMinutes(0, 0, 0)
  return toDateTimeLocal(d)
}

describe('toDateTimeLocal', () => {
  it('formats local time the way a datetime-local input expects', () => {
    expect(toDateTimeLocal(new Date(2026, 8, 5, 7, 3))).toBe('2026-09-05T07:03')
  })
})

describe('readInitialSettings', () => {
  it('opens on tomorrow at this hour and the default speed', () => {
    expect(read('')).toEqual({ startDateTime: tomorrowOnTheHour(), speedKph: DEFAULT_SPEED_KPH })
  })

  it('takes the start and speed Weather 4 Bike links with', () => {
    expect(read('?start=2026-09-14T14:00:00.000Z&speed=28')).toEqual({ startDateTime: local('2026-09-14T14:00:00Z'), speedKph: 28 })
  })

  it('keeps a window that began within the last hour', () => {
    expect(read('?start=2026-09-13T10:00:00Z').startDateTime).toBe(local('2026-09-13T10:00:00Z'))
  })

  it('ignores a start that is over, out of forecast range, or not a date', () => {
    for (const start of ['2026-09-13T09:00:00Z', '2026-10-13T09:00:00Z', 'soon', '']) {
      expect(read(`?start=${start}`).startDateTime).toBe(tomorrowOnTheHour())
    }
  })

  it("uses the speed set in Weather 4 Bike when the link doesn't carry one", () => {
    expect(read('', { [SHARED_SPEED_KEY]: '31' }).speedKph).toBe(31)
    expect(read('?speed=18', { [SHARED_SPEED_KEY]: '31' }).speedKph).toBe(18)
  })

  it('rounds and clamps speeds to the slider, and skips ones that make no sense', () => {
    expect(read('?speed=27.6').speedKph).toBe(28)
    expect(read('?speed=5').speedKph).toBe(12)
    expect(read('?speed=60').speedKph).toBe(40)
    expect(read('?speed=fast', { [SHARED_SPEED_KEY]: '-4' }).speedKph).toBe(DEFAULT_SPEED_KPH)
  })

  it('falls back to the default speed when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError') } }
    expect(readInitialSettings({ search: '', storage: blocked, now: NOW }).speedKph).toBe(DEFAULT_SPEED_KPH)
  })
})
