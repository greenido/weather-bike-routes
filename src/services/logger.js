/*
  File: src/services/logger.js
  Purpose: Lightweight console logger for development visibility.
  What it does:
  - Enriches log entries with id and ISO timestamp.
  - Outputs categorized messages to the console for key events.
  Exports:
  - logEvent(entry): enrich + console log.
*/

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
}
