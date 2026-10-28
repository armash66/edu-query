import React from 'react'
import { GlassCard } from './GlassCard'

export interface StatDelta {
  value: string | number
  direction?: 'up' | 'down' | 'neutral'
  label?: string
}

export interface StatProps {
  label: string
  value: string | number
  delta?: StatDelta
  subtext?: string
  icon?: React.ReactNode
  chartSlot?: React.ReactNode
  variant?: 'glass-1' | 'glass-2' | 'glass-3'
  className?: string
  style?: React.CSSProperties
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  delta,
  subtext,
  icon,
  chartSlot,
  variant = 'glass-2',
  className = '',
  style,
}) => {
  const getDeltaStyle = () => {
    if (!delta?.direction || delta.direction === 'neutral') {
      return {
        bg: 'var(--surface-hover)',
        color: 'var(--text-muted)',
      }
    }
    if (delta.direction === 'up') {
      return {
        bg: 'var(--status-success-bg)',
        color: 'var(--status-success-text)',
      }
    }
    return {
      bg: 'var(--status-danger-bg)',
      color: 'var(--status-danger-text)',
    }
  }

  const deltaStyle = getDeltaStyle()

  return (
    <GlassCard
      variant={variant}
      padding="md"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              color: 'var(--text-muted)',
              display: 'inline-flex',
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-3)',
          margin: 'var(--space-1) 0',
        }}
      >
        <span
          className="tabular-nums font-mono"
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>

        {delta && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: deltaStyle.bg,
              color: deltaStyle.color,
            }}
          >
            {delta.direction === 'up' && '↑'}
            {delta.direction === 'down' && '↓'}
            {delta.value}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'var(--space-1)',
        }}
      >
        {subtext && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            {subtext}
          </span>
        )}
        {chartSlot && <div>{chartSlot}</div>}
      </div>
    </GlassCard>
  )
}
