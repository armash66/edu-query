import React from 'react'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
  style,
}) => {
  const defaultIcon = (
    <svg
      viewBox="0 0 24 24"
      width="44"
      height="44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-muted)' }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )

  return (
    <div
      className={`glass-1 ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-6)',
        borderRadius: 'var(--radius-card)',
        border: '1px dashed var(--border-strong)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--surface-hover)',
          marginBottom: 'var(--space-4)',
        }}
      >
        {icon || defaultIcon}
      </div>

      <h3
        style={{
          fontSize: 'var(--text-md)',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            maxWidth: '420px',
            lineHeight: 1.5,
            marginBottom: action ? 'var(--space-6)' : 0,
          }}
        >
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  )
}
