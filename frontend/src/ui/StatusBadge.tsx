import React from 'react'

export type StatusTone = 'pass' | 'fail' | 'warn' | 'info'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone
  label?: string
  children?: React.ReactNode
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  label,
  children,
  size = 'md',
  showIcon = true,
  className = '',
  style,
  ...props
}) => {
  const content = label ?? children
  const toneStyles: Record<
    StatusTone,
    { text: string; bg: string; border: string; defaultIcon: React.ReactNode }
  > = {
    pass: {
      text: 'var(--status-success-text)',
      bg: 'var(--status-success-bg)',
      border: 'var(--status-success-border)',
      defaultIcon: (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 8.5 6.5 12 13 4.5" />
        </svg>
      ),
    },
    fail: {
      text: 'var(--status-danger-text)',
      bg: 'var(--status-danger-bg)',
      border: 'var(--status-danger-border)',
      defaultIcon: (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      ),
    },
    warn: {
      text: 'var(--status-warning-text)',
      bg: 'var(--status-warning-bg)',
      border: 'var(--status-warning-border)',
      defaultIcon: (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2.5L1.5 13.5h13L8 2.5z" />
          <line x1="8" y1="7" x2="8" y2="9.5" />
          <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
        </svg>
      ),
    },
    info: {
      text: 'var(--status-info-text)',
      bg: 'var(--status-info-bg)',
      border: 'var(--status-info-border)',
      defaultIcon: (
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="7" x2="8" y2="11" />
          <circle cx="8" cy="4.5" r="0.5" fill="currentColor" />
        </svg>
      ),
    },
  }

  const { text, bg, border, defaultIcon } = toneStyles[tone]

  const sizeStyles = {
    sm: {
      padding: '2px 6px',
      fontSize: 'var(--text-xs)',
      height: '20px',
      gap: '4px',
    },
    md: {
      padding: '3px 8px',
      fontSize: 'var(--text-xs)',
      height: '24px',
      gap: '5px',
    },
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {showIcon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'inherit',
          }}
          aria-hidden="true"
        >
          {defaultIcon}
        </span>
      )}
      <span>{content}</span>
    </span>
  )
}
