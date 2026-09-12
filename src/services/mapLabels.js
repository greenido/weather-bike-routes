/*
  File: src/services/mapLabels.js
  Purpose: Choose where the temperature labels go along the route on the map, so they never pile up.
  What it does:
  - labelMarks(timeline): candidate points nearest to whole-km marks (farther apart on long rides), rounder marks
    first, so zooming in adds labels between the ones already shown. The start and finish have labels of their own.
  - placeLabels(candidates, { labels, blocked, gapPx }): keeps each candidate box, in order, that doesn't touch a
    `blocked` box (like an arrow) and stays `gapPx` clear of the labels already there. Boxes are
    { x0, y0, x1, y1 } in screen pixels.
*/
const MARK_STEPS_KM = [1, 2, 5, 10, 20, 50]
const MAX_MARKS = 60
const ROUND_KM = [100, 50, 20, 10, 5, 2, 1]

export function labelMarks(timeline) {
  const totalKm = timeline.at(-1).km
  const step = MARK_STEPS_KM.find((s) => totalKm / s <= MAX_MARKS) ?? 100
  const marks = []
  let i = 0
  for (let km = step; km < totalKm; km += step) {
    while (timeline[i].km < km) i++
    const index = km - timeline[i - 1].km < timeline[i].km - km ? i - 1 : i
    if (index > 0 && index < timeline.length - 1 && marks.at(-1)?.index !== index) marks.push({ km, index })
  }
  const roundness = (km) => ROUND_KM.findIndex((r) => km % r === 0)
  return marks.sort((a, b) => roundness(a.km) - roundness(b.km) || a.km - b.km).map((mark) => mark.index)
}

export function placeLabels(candidates, { labels = [], blocked = [], gapPx = 0 }) {
  const placed = [...labels]
  return candidates.filter((box) => {
    if (blocked.some((b) => overlaps(box, b, 0)) || placed.some((b) => overlaps(box, b, gapPx))) return false
    placed.push(box)
    return true
  })
}

const overlaps = (a, b, gap) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap
