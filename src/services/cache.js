/*
  File: src/services/cache.js
  Purpose: Provide simple IndexedDB caching for weather responses and local storage for the API key.
  What it does:
  - Stores/retrieves Visual Crossing responses by (lat,lon,day) to reduce network calls.
  - Persists the user's API key in localStorage.
  Exports:
  - getCachedWeather / setCachedWeather
  - buildWeatherKey
  - getStoredApiKey / setStoredApiKey
*/
import { openDB } from 'idb'

const DB_NAME = 'weather-bike-routes-db'
const DB_VERSION = 1
const STORE_WEATHER = 'weatherByDay'

let dbPromise

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_WEATHER)) {
          const store = database.createObjectStore(STORE_WEATHER, {
            keyPath: 'key',
          })
          store.createIndex('byDate', 'date')
        }
      },
    })
  }
  return dbPromise
}

export function buildWeatherKey(lat, lon, isoDate) {
  const latFixed = Number(lat).toFixed(4)
  const lonFixed = Number(lon).toFixed(4)
  return `${latFixed},${lonFixed}:${isoDate}`
}

export async function getCachedWeather(lat, lon, isoDate) {
  const db = await getDb()
  const key = buildWeatherKey(lat, lon, isoDate)
  const record = await db.get(STORE_WEATHER, key)
  return record ? record.data : undefined
}

export async function setCachedWeather(lat, lon, isoDate, data) {
  const db = await getDb()
  const key = buildWeatherKey(lat, lon, isoDate)
  const record = { key, date: isoDate, data, cachedAt: Date.now() }
  await db.put(STORE_WEATHER, record)
}

export function getStoredApiKey() {
  return localStorage.getItem('visualCrossingApiKey') || ''
}

export function setStoredApiKey(keyValue) {
  localStorage.setItem('visualCrossingApiKey', keyValue || '')
}


