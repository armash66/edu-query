import React from 'react'

export interface DivisionItem {
  division: string
  count: number
  percentage?: number
  tone?: 'pass' | 'fail' | 'warn' | 'info' | 'neutral'
}

export interface DivisionComparisonProps {
  divisions: DivisionItem[]
  total?: number
  title?: string
  className?: string
  style?: React.CSSProperties
}

export const DivisionComparison: React.FC<DivisionComparisonProps> = ({
  divisions,
  total: customTotal,
  title,
  className = '',
  style,
}) => {
  const computedTotal = divisions.reduce((acc, curr) => acc + curr.count, 0)
  const total = customTotal && customTotal > 0 ? customTotal : computedTotal
  const maxCount = Math.max(...divisions.map((d) => d.count), 1)

  const toneFillMap = {
    pass: 'var(--status-success-text)',
    fail: 'var(--status-danger-text)',
    warn: 'var(--status-warning-text)',
    info: 'var(--text)',
    neutral: 'var(--neutral-500)',
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        width: '100%',
        ...style,
      }}
    >
      {title && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {divisions.map((item) => {
          const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0'
          const barWidthPct = (item.count / maxCount) * 100
          const fillColor = toneFillMap[item.tone || 'info']

          return (
            <div
              key={item.division}
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1fr 65px',
                alignItems: 'center',
                gap: 'var(--space-3)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={item.division}
              >
                {item.division}
              </span>

              <div
                style={{
                  width: '100%',
                  height: '14px',
                  background: 'var(--surface-hover)',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${barWidthPct}%`,
                    height: '100%',
                    background: fillColor,
                    borderRadius: 'var(--radius-xs)',
                    transition: 'width var(--transition-normal)',
                  }}
                  role="presentation"
                />
              </div>

              <div
                className="tabular-nums font-mono"
                style={{
                  textAlign: 'right',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({item.count})</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
