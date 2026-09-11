/*
  File: src/components/ScoreBreakdown.jsx
  Purpose: Present the penalty contributions that form a route's final score.
  What it does:
  - Renders wind, temperature, rain, and visibility penalty values with icons (and screen-reader labels).
  - Formats negatives as bonuses (prefixed with '+') and positives as penalties (prefixed with '-').
  Notes:
  - Uses only inline elements because it renders inside the route card's <button>.
*/
import { Fragment } from 'react'
import { CloudRain, Eye, Thermometer, Wind } from 'lucide-react'

const FACTORS = [
  { key: 'wind', label: 'Wind', Icon: Wind },
  { key: 'temperature', label: 'Temperature', Icon: Thermometer },
  { key: 'rain', label: 'Rain', Icon: CloudRain },
  { key: 'visibility', label: 'Visibility', Icon: Eye },
]

export default function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null
  return (
    <span className="text-sm text-gray-600 flex gap-x-4 gap-y-1 flex-wrap items-center">
      {FACTORS.map((factor, i) => {
        const Icon = factor.Icon
        return (
          <Fragment key={factor.key}>
            {i > 0 && <span aria-hidden="true">•</span>}
            <span className="inline-flex items-center gap-1" title={factor.label}>
              <Icon size={16} aria-hidden="true" />
              <span className="sr-only">{factor.label}</span>
              {formatValue(breakdown[factor.key])}
            </span>
          </Fragment>
        )
      })}
    </span>
  )
}

function formatValue(value) {
  const v = Number(value || 0)
  if (v === 0) return '0'
  return v < 0 ? `+${Math.abs(v).toFixed(1)}` : `-${v.toFixed(1)}`
}
