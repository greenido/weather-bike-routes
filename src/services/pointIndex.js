/*
  File: src/services/pointIndex.js
  Purpose: Find the route point nearest the pointer without walking the whole route on every mouse move.
  What it does:
  - buildPointIndex(points): buckets projected pixel points into a grid of CELL_PX squares.
  - nearestPointWithin(index, point, radiusPx): the index of the closest point within `radiusPx`, or null.
  Notes:
  - Cells are exactly the search radius across, so a point within the radius can only be in the asked-for cell or
    one of its eight neighbours: checking those nine is both correct and enough. A route thinned to the app's
    2,000 points then costs a handful of comparisons per mouse move instead of 2,000 projections.
*/
export const CELL_PX = 24

const cellKey = (x, y) => `${Math.floor(x / CELL_PX)},${Math.floor(y / CELL_PX)}`

export function buildPointIndex(points) {
  const cells = new Map()
  points.forEach(({ x, y }, i) => {
    const key = cellKey(x, y)
    const bucket = cells.get(key)
    if (bucket) bucket.push(i)
    else cells.set(key, [i])
  })
  return { points, cells }
}

export function nearestPointWithin(index, { x, y }, radiusPx = CELL_PX) {
  const col = Math.floor(x / CELL_PX)
  const row = Math.floor(y / CELL_PX)
  let best = null
  let bestPx = radiusPx
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const bucket = index.cells.get(`${col + dc},${row + dr}`)
      if (!bucket) continue
      for (const i of bucket) {
        const px = Math.hypot(index.points[i].x - x, index.points[i].y - y)
        // Ties go to the earlier point, matching a plain scan from the start of the route.
        if (px < bestPx) {
          bestPx = px
          best = i
        }
      }
    }
  }
  return best
}
