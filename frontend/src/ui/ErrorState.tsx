import React from 'react'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  message: string
  details?: string
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  retryLabel = 'Try again',
  action,
  className = '',
  style,
}) => {
  return (
    <div
      role="alert"
      className={`glass-2 ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-12) var(--space-6)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--status-danger-border)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--status-danger-bg)',
          color: 'var(--status-danger-text)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h3
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          maxWidth: '460px',
          lineHeight: 1.5,
          marginBottom: onRetry || action || details ? 'var(--space-4)' : 0,
        }}
      >
        {message}
      </p>

      {details && (
        <pre
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'var(--surface-hover)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '500px',
            overflowX: 'auto',
            marginBottom: onRetry || action ? 'var(--space-6)' : 0,
            textAlign: 'left',
          }}
        >
          {details}
        </pre>
      )}

      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}

      {action && !onRetry && <div>{action}</div>}
    </div>
  )
}
