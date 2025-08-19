let entries = []
const subscribers = new Set()

function notify() {
  for (const fn of subscribers) {
    try { fn(entries) } catch (err) { console.warn('Logger subscriber callback failed', err) }
  }
}

export function logEvent(entry) {
  const enriched = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  }
  try {
    const { type, ...rest } = enriched
    if (type === 'weather:fetch') {
      console.info('[weather:fetch]', rest)
    } else if (type === 'weather:aggregate') {
      console.info('[weather:aggregate]', rest)
    } else if (type === 'route:weather') {
      console.info('[route:weather]', rest)
    } else {
      console.log('[log]', enriched)
    }
  } catch (err) {
    console.warn('Logger console output failed', err)
  }
  if (subscribers.size > 0) {
    entries = [...entries, enriched]
    notify()
  }
}

export function subscribe(callback) {
  subscribers.add(callback)
  try { callback(entries) } catch (err) { console.warn('Logger initial callback failed', err) }
  return () => subscribers.delete(callback)
}

export function getEntries() {
  return entries
}

export function clear() {
  entries = []
  notify()
}
