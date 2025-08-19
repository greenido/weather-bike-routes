import { Wind, Thermometer, Droplets, Eye } from 'lucide-react'

export default function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null
  const { windPenalty, tempPenalty, humidityPenalty, visibilityPenalty } = breakdown
  return (
    <div className="text-sm text-gray-600 flex gap-4 flex-wrap items-center">
      <span className="inline-flex items-center gap-1"><Wind size={16} /> {formatValue(windPenalty)}</span>
      <span>•</span>
      <span className="inline-flex items-center gap-1"><Thermometer size={16} /> {formatValue(tempPenalty)}</span>
      <span>•</span>
      <span className="inline-flex items-center gap-1"><Droplets size={16} /> {formatValue(humidityPenalty)}</span>
      <span>•</span>
      <span className="inline-flex items-center gap-1"><Eye size={16} /> {formatValue(visibilityPenalty)}</span>
    </div>
  )
}

function formatValue(value) {
  const v = Number(value || 0)
  if (v === 0) return '0'
  return v < 0 ? `+${Math.abs(v).toFixed(1)}` : `-${v.toFixed(1)}`
}


