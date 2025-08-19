/*
  File: src/services/scoringEngine.js
  Purpose: Convert aggregated weather + route heading into a rider-friendly score and color.
  What it does:
  - calculateRouteScore(inputs): computes a 1–10 score taking wind, temperature, humidity, and visibility into account.
  - colorForScore(score): maps score to a semantic color (green/orange/red) for UI emphasis.
  Scoring model:
  - Wind penalties scale with speed; headwinds magnify penalties; tailwinds grant a small bonus.
  - Temperature outside 15–22°C reduces score; extreme heat (>40°C) clamps to 1.
  - Higher humidity and lower visibility reduce score.
*/
export function calculateRouteScore({ windSpeed, windDirection, tempC, humidity, visibilityKm, routeHeading }) {
  let score = 10

  // Wind: up to 10 km/h no change; over 15 km/h reduces score.
  // Directional impact: headwind hurts more (x1.8); tailwind grants a +1.5 bonus.
  let windPenalty = windSpeed > 45 ? 4 :
                    windSpeed > 35 ? 3 :
                    windSpeed > 25 ? 2.5 :
                    windSpeed > 15 ? 1.5 : 0

  const relative = Math.abs(windDirection - routeHeading) % 360
  if (relative < 45 || relative > 315) {
    windPenalty *= 1.8
  } else if (relative > 135 && relative < 225) {
    // Tailwind: apply bonus after penalties
    windPenalty -= 1.5
  }

  score -= windPenalty

  // Temperature: ideal band 15–22°C.
  // Below 15 reduces; harsher under 5°C. Above 22 reduces; harsher over 35°C; >40 is a no-go.
  if (tempC > 40) {
    score = 1
  } else {
    if (tempC < 5) score -= 3
    else if (tempC < 10) score -= 2
    else if (tempC < 15) score -= 1

    if (tempC > 35) score -= 3
    else if (tempC > 30) score -= 2
    else if (tempC > 22) score -= 1
  }

  // Humidity: 0–67% no penalty; >68% some; >80% more; >90% even more
  if (humidity > 90) score -= 3
  else if (humidity > 80) score -= 2
  else if (humidity >= 68) score -= 1

  if (visibilityKm < 2) score -= 3
  else if (visibilityKm < 5) score -= 2
  else if (visibilityKm < 10) score -= 1

  return Math.max(1, Math.min(10, score))
}

export function colorForScore(score) {
  if (score >= 8) return 'green'
  if (score >= 6) return 'orange'
  return 'red'
}


