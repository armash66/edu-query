import React from 'react'

export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  fillArea?: boolean
  className?: string
  style?: React.CSSProperties
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 24,
  strokeColor = 'var(--text)',
  fillArea = true,
  className = '',
  style,
}) => {
  if (!data || data.length < 2) {
    return null
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const padding = 2
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * innerWidth
    const y = height - padding - ((val - min) / range) * innerHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const pathD = `M ${points.join(' L ')}`
  const fillD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`

  const gradId = `spark-grad-${Math.random().toString(36).substring(2, 7)}`

  return (
    <svg
      role="img"
      aria-label={`Trend sparkline: min ${min}, max ${max}`}
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {fillArea && <path d={fillD} fill={`url(#${gradId})`} />}

      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
