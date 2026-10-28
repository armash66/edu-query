import React from 'react'

export interface LoadingStateProps {
  message?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-6)',
        color: 'var(--text-secondary)',
        gap: 'var(--space-3)',
      }}
      role="status"
    >
      <svg
        aria-hidden="true"
        style={{
          width: '32px',
          height: '32px',
          animation: 'spin 1s linear infinite',
          color: 'var(--text)',
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="40 60"
        />
      </svg>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {message}
      </span>
    </div>
  )
}
