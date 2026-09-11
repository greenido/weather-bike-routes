/*
  File: src/services/cache.js
  Purpose: Cache hourly forecasts in IndexedDB and keep the optional Visual Crossing API key in localStorage.
  What it does:
  - getCachedForecast(key) / setCachedForecast(key, data): best-effort cache of normalized hourly series.
    Entries expire after FORECAST_TTL_MS because forecasts change; expired entries are pruned when the DB opens.
  - isFresh(record, now): the expiry rule, exported for tests.
  - getStoredApiKey / setStoredApiKey: the optional Visual Crossing key (empty means "use Open-Meteo").
  Notes:
  - Every cache call swallows storage errors (private mode, blocked storage, tests without IndexedDB).
*/
import { openDB } from 'idb'

const DB_NAME = 'weather-bike-routes-db'
const DB_VERSION = 2
const STORE = 'forecasts'
const API_KEY_STORAGE = 'visualCrossingApiKey'
export const FORECAST_TTL_MS = 2 * 60 * 60 * 1000

let dbPromise

function getDb() {
  if (!dbPromise) {
    dbPromise = Promise.resolve()
      .then(() => openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          // v1 cached raw Visual Crossing days forever; v2 stores normalized series with an expiry.
          if (database.objectStoreNames.contains('weatherByDay')) database.deleteObjectStore('weatherByDay')
          if (!database.objectStoreNames.contains(STORE)) {
            database.createObjectStore(STORE, { keyPath: 'key' }).createIndex('byCachedAt', 'cachedAt')
          }
        },
      }))
      .then(async (database) => {
        await pruneExpired(database)
        return database
      })
  }
  return dbPromise
}

async function pruneExpired(database) {
  const tx = database.transaction(STORE, 'readwrite')
  let cursor = await tx.store.index('byCachedAt').openCursor(IDBKeyRange.upperBound(Date.now() - FORECAST_TTL_MS))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export function isFresh(record, now = Date.now()) {
  return Boolean(record) && now - record.cachedAt < FORECAST_TTL_MS
}

export async function getCachedForecast(key) {
  try {
    const record = await (await getDb()).get(STORE, key)
    return isFresh(record) ? record.data : undefined
  } catch {
    return undefined
  }
}

export async function setCachedForecast(key, data) {
  try {
    await (await getDb()).put(STORE, { key, data, cachedAt: Date.now() })
  } catch {
    // Caching is best-effort.
  }
}

export function getStoredApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setStoredApiKey(keyValue) {
  try {
    if (keyValue) localStorage.setItem(API_KEY_STORAGE, keyValue)
    else localStorage.removeItem(API_KEY_STORAGE)
  } catch {
    // Storage can be blocked; the key then lasts for this session only.
  }
}
