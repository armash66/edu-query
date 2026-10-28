import React from 'react'

export interface OutcomeBarProps {
  passed: number
  failed: number
  absent?: number
  total?: number
  height?: number
  showLegend?: boolean
  className?: string
  style?: React.CSSProperties
}

export const OutcomeBar: React.FC<OutcomeBarProps> = ({
  passed,
  failed,
  absent = 0,
  total: customTotal,
  height = 20,
  showLegend = true,
  className = '',
  style,
}) => {
  const computedTotal = passed + failed + absent
  const total = customTotal && customTotal > 0 ? customTotal : computedTotal

  const passPct = total > 0 ? (passed / total) * 100 : 0
  const failPct = total > 0 ? (failed / total) * 100 : 0
  const absentPct = total > 0 ? (absent / total) * 100 : 0

  const summaryText = `Pass: ${passed} (${passPct.toFixed(1)}%), Fail: ${failed} (${failPct.toFixed(
    1
  )}%), Absent: ${absent} (${absentPct.toFixed(1)}%)`

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        width: '100%',
        ...style,
      }}
    >
      {/* SVG Stacked Bar */}
      <svg
        role="img"
        aria-label={summaryText}
        width="100%"
        height={height}
        style={{
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--surface-hover)',
        }}
      >
        <title>{summaryText}</title>

        {/* Passed Segment */}
        {passPct > 0 && (
          <rect
            x="0%"
            y="0"
            width={`${passPct}%`}
            height="100%"
            fill="var(--status-success-text)"
            style={{ transition: 'width var(--transition-normal)' }}
          />
        )}

        {/* Failed Segment */}
        {failPct > 0 && (
          <rect
            x={`${passPct}%`}
            y="0"
            width={`${failPct}%`}
            height="100%"
            fill="var(--status-danger-text)"
            style={{ transition: 'width var(--transition-normal)' }}
          />
        )}

        {/* Absent Segment */}
        {absentPct > 0 && (
          <rect
            x={`${passPct + failPct}%`}
            y="0"
            width={`${absentPct}%`}
            height="100%"
            fill="var(--text-muted)"
            opacity="0.6"
            style={{ transition: 'width var(--transition-normal)' }}
          />
        )}
      </svg>

      {/* Accessible Legend */}
      {showLegend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '2px',
                background: 'var(--status-success-text)',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span>
              Pass: <strong className="tabular-nums font-mono">{passPct.toFixed(1)}%</strong> ({passed})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '2px',
                background: 'var(--status-danger-text)',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span>
              Fail: <strong className="tabular-nums font-mono">{failPct.toFixed(1)}%</strong> ({failed})
            </span>
          </div>

          {absent > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: 'var(--text-muted)',
                  display: 'inline-block',
                  opacity: 0.6,
                }}
                aria-hidden="true"
              />
              <span>
                Absent: <strong className="tabular-nums font-mono">{absentPct.toFixed(1)}%</strong> ({absent})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
