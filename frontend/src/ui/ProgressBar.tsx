import React from 'react'

export interface ProgressBarProps {
  value?: number // 0 to 100, undefined for indeterminate
  max?: number
  tone?: 'default' | 'pass' | 'fail' | 'warn'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
  className?: string
  style?: React.CSSProperties
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  tone = 'default',
  size = 'md',
  showLabel = false,
  label,
  className = '',
  style,
}) => {
  const isIndeterminate = value === undefined
  const percentage = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100))

  const heightMap = {
    sm: '4px',
    md: '8px',
    lg: '12px',
  }

  const toneFillMap = {
    default: 'var(--action-primary-bg)',
    pass: 'var(--status-success-text)',
    fail: 'var(--status-danger-text)',
    warn: 'var(--status-warning-text)',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        width: '100%',
        ...style,
      }}
      className={className}
    >
      {(showLabel || label) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          {label && <span>{label}</span>}
          {!isIndeterminate && showLabel && (
            <span className="tabular-nums" style={{ fontWeight: 600 }}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        style={{
          width: '100%',
          height: heightMap[size],
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface-hover)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isIndeterminate ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              background: toneFillMap[tone],
              borderRadius: 'var(--radius-full)',
              animation: 'indeterminateSlide 1.5s infinite ease-in-out',
            }}
          />
        ) : (
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: toneFillMap[tone],
              borderRadius: 'var(--radius-full)',
              transition: 'width var(--transition-normal)',
            }}
          />
        )}
      </div>
    </div>
  )
}
