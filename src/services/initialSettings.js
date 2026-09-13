/*
  File: src/services/initialSettings.js
  Purpose: The start time and average speed the app opens with.
  What it does:
  - Reads `?start=` (an ISO instant) and `?speed=` (km/h) from the URL. Weather 4 Bike links here with its best
    riding window and the rider's speed, so the routes are scored for the ride that app just recommended.
  - Without `?speed=`, uses the speed the rider set in Weather 4 Bike. Both apps are served from greenido.github.io,
    so they share localStorage; `w4b:ridingSpeed` (km/h) is only ever read here, never written.
  - Otherwise opens on tomorrow at this hour and DEFAULT_SPEED_KPH.
  Notes:
  - A start that is long over or beyond the forecast range is ignored, so an old bookmark can't open on a stale ride.
  - Speeds are clamped to the slider's range rather than rejected.
*/
import { MAX_DAYS_AHEAD } from './weatherClient'

export const MIN_SPEED_KPH = 12
export const MAX_SPEED_KPH = 40
export const DEFAULT_SPEED_KPH = 22
export const SHARED_SPEED_KEY = 'w4b:ridingSpeed'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// A date in the local-time form <input type="datetime-local"> expects, e.g. "2026-09-19T07:00".
export function toDateTimeLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultStart(now) {
  const d = new Date(now + DAY_MS)
  d.setMinutes(0, 0, 0)
  return d
}

// A window that began within the last hour is still on; Weather 4 Bike's windows start on the hour.
function parseStart(value, now) {
  const ms = Date.parse(value ?? '')
  if (!Number.isFinite(ms) || ms < now - HOUR_MS || ms > now + MAX_DAYS_AHEAD * DAY_MS) return null
  return new Date(ms)
}

function parseSpeed(value) {
  const kph = Number(value)
  if (!(kph > 0) || !Number.isFinite(kph)) return null
  return Math.min(MAX_SPEED_KPH, Math.max(MIN_SPEED_KPH, Math.round(kph)))
}

function sharedSpeed(storage) {
  try {
    return parseSpeed((storage ?? window.localStorage).getItem(SHARED_SPEED_KEY))
  } catch {
    return null // Storage can be blocked (private mode, site data off).
  }
}

export function readInitialSettings({ search = window.location.search, storage, now = Date.now() } = {}) {
  const params = new URLSearchParams(search)
  return {
    startDateTime: toDateTimeLocal(parseStart(params.get('start'), now) ?? defaultStart(now)),
    speedKph: parseSpeed(params.get('speed')) ?? sharedSpeed(storage) ?? DEFAULT_SPEED_KPH,
  }
}
