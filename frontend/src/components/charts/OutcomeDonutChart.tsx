import React, { useState } from 'react'
import type { OutcomeDistributionItem } from '../../api/types'

interface OutcomeDonutChartProps {
  data: OutcomeDistributionItem[]
  totalStudents: number
  onSelectStatus?: (status: string) => void
}

export const OutcomeDonutChart: React.FC<OutcomeDonutChartProps> = ({
  data,
  totalStudents,
  onSelectStatus,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0 || totalStudents === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No outcome distribution records available for this cohort.
      </div>
    )
  }

  // Color mapping by normalized status
  const getColor = (status: string): { fill: string; bg: string; text: string } => {
    const s = status.toUpperCase()
    if (s.includes('PASS')) return { fill: '#10b981', bg: '#ecfdf5', text: '#065f46' }
    if (s.includes('FAIL')) return { fill: '#ef4444', bg: '#fef2f2', text: '#991b1b' }
    return { fill: '#f59e0b', bg: '#fffbeb', text: '#92400e' }
  }

  // Calculate SVG arc paths
  const radius = 64
  const strokeWidth = 22
  const center = 80
  const circumference = 2 * Math.PI * radius

  let accumulatedPercent = 0
  const slices = data.map((item, idx) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference)
    accumulatedPercent += item.percentage
    const colors = getColor(item.status)
    return {
      ...item,
      idx,
      strokeDasharray,
      strokeDashoffset,
      colors,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.idx
            return (
              <circle
                key={slice.status}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.colors.fill}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                style={{
                  transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                  cursor: onSelectStatus ? 'pointer' : 'default',
                  opacity: hoveredIdx !== null && !isHovered ? 0.6 : 1,
                }}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onSelectStatus?.(slice.status)}
              />
            )
          })}
        </svg>

        {/* Centered Total Label */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
            {hoveredIdx !== null ? data[hoveredIdx].count : totalStudents}
          </div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>
            {hoveredIdx !== null ? data[hoveredIdx].status : 'Evaluated'}
          </div>
        </div>
      </div>

      {/* Legend & Click Targets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
        {data.map((item, idx) => {
          const colors = getColor(item.status)
          const isHovered = hoveredIdx === idx
          return (
            <button
              key={item.status}
              type="button"
              onClick={() => onSelectStatus?.(item.status)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.6rem',
                backgroundColor: isHovered ? colors.bg : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: isHovered ? colors.fill : 'transparent',
                cursor: onSelectStatus ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                width: '100%',
              }}
              title={`Click to filter by ${item.status}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: colors.fill,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-main)' }}>
                  {item.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {item.count}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ({item.percentage}%)
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
