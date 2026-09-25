/*
  File: public/sw.js
  Purpose: Make the app open without a connection, which matters when you check a route at the trailhead.
  What it does:
  - Navigations: tries the network, falls back to the last cached copy of the page. That keeps a new deploy
    showing up straight away while still opening offline.
  - Same-origin files (the hashed JS, CSS and icons Vite builds): served from the cache, fetched and stored the
    first time. Their names carry a content hash, so a cached file is never the wrong version.
  - Everything cross-origin is left alone and goes straight to the network: map tiles, because the OpenStreetMap
    tile policy asks apps not to stockpile them, and forecasts, because they already have their own two-hour
    cache in IndexedDB with an expiry the service worker has no way to honour.
  Notes:
  - Registered from src/main.jsx, and only in a production build; caching Vite's dev modules would break HMR.
  - The asset cache is trimmed to MAX_ASSETS, oldest first, so builds can't pile up without bound.
  - Bump CACHE when this file's caching rules change; that drops every older cache on the next activate.
*/
const CACHE = 'bike-route-weather-v1'
const MAX_ASSETS = 60
// The scope this worker was registered under, e.g. "/weather-bike-routes/". Also the page to fall back to.
const SHELL = new URL('./', self.location).pathname

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Tiles and forecasts: straight to the network.

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  if (url.pathname.startsWith(SHELL)) event.respondWith(cacheFirst(request))
})

// A fresh page when there is a connection, the last one that loaded when there isn't.
async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(SHELL, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(SHELL)
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // Opaque and error responses are not worth keeping, and caching them would hide a real failure.
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
    await trim(cache)
  }
  return response
}

// cache.keys() comes back in insertion order, so dropping from the front retires the oldest build's files first.
async function trim(cache) {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ASSETS
  for (let i = 0; i < excess; i++) await cache.delete(keys[i])
}
