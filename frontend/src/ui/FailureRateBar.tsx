import React from 'react'

export interface FailureRateBarProps {
  subjectCode: string
  subjectName: string
  failureRate: number // 0 to 100 percentage
  failedStudents: number
  totalStudents: number
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

export const FailureRateBar: React.FC<FailureRateBarProps> = ({
  subjectCode,
  subjectName,
  failureRate,
  failedStudents,
  totalStudents,
  onClick,
  className = '',
  style,
}) => {
  // Tiered color rule: Green < 5%, Amber 5-15%, Red > 15%
  const getTier = (rate: number) => {
    if (rate < 5) {
      return {
        fill: 'var(--status-success-text)',
        label: 'Low',
        bg: 'var(--status-success-bg)',
        border: 'var(--status-success-border)',
      }
    }
    if (rate <= 15) {
      return {
        fill: 'var(--status-warning-text)',
        label: 'Moderate',
        bg: 'var(--status-warning-bg)',
        border: 'var(--status-warning-border)',
      }
    }
    return {
      fill: 'var(--status-danger-text)',
      label: 'High',
      bg: 'var(--status-danger-bg)',
      border: 'var(--status-danger-border)',
    }
  }

  const tier = getTier(failureRate)

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={`glass-1 ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.transform = 'none'
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            className="font-mono"
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--surface-hover)',
              color: 'var(--text)',
            }}
          >
            {subjectCode}
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '260px',
            }}
            title={subjectName}
          >
            {subjectName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            className="tabular-nums font-mono"
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: tier.fill,
            }}
          >
            {failureRate.toFixed(1)}%
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            ({failedStudents}/{totalStudents})
          </span>
        </div>
      </div>

      {/* Bar meter */}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: 'var(--surface-hover)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, failureRate)}%`,
            height: '100%',
            background: tier.fill,
            borderRadius: 'var(--radius-full)',
            transition: 'width var(--transition-normal)',
          }}
          role="presentation"
        />
      </div>
    </div>
  )
}
