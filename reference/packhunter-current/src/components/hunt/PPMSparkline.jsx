/**
 * PPMSparkline — Lightweight SVG sparkline for PPM trend.
 * No chart library dependency. Renders from the ppmHistory array.
 */
import { memo } from 'react'

const PPMSparkline = memo(({ data = [], width = 120, height = 32, color = '#7c8aff' }) => {
  if (!data || data.length < 2) return null

  const values = data.map(d => d.v ?? d ?? 0)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  // Gradient fill area
  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="ppm-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#ppm-spark-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current value dot */}
      {values.length > 0 && (() => {
        const lastVal = values[values.length - 1]
        const cx = width
        const cy = height - ((lastVal - min) / range) * (height - 4) - 2
        return <circle cx={cx} cy={cy} r="2.5" fill={color} />
      })()}
    </svg>
  )
})

PPMSparkline.displayName = 'PPMSparkline'
export default PPMSparkline
