import React from 'react'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'active' | 'pass' | 'fail' | 'warn' | 'info'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  onRemove?: () => void
  removeLabel?: string
  children: React.ReactNode
}

export const Chip: React.FC<ChipProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  onRemove,
  removeLabel = 'Remove',
  children,
  className = '',
  style,
  ...props
}) => {
  const sizeStyles = {
    sm: {
      padding: onRemove ? '2px 4px 2px 8px' : '2px 8px',
      fontSize: 'var(--text-xs)',
      height: '24px',
    },
    md: {
      padding: onRemove ? '4px 6px 4px 10px' : '4px 10px',
      fontSize: 'var(--text-sm)',
      height: '28px',
    },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--surface-hover)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    },
    active: {
      background: 'var(--action-primary-bg)',
      color: 'var(--action-primary-text)',
      border: '1px solid var(--action-primary-bg)',
    },
    pass: {
      background: 'var(--status-success-bg)',
      color: 'var(--status-success-text)',
      border: '1px solid var(--status-success-border)',
    },
    fail: {
      background: 'var(--status-danger-bg)',
      color: 'var(--status-danger-text)',
      border: '1px solid var(--status-danger-border)',
    },
    warn: {
      background: 'var(--status-warning-bg)',
      color: 'var(--status-warning-text)',
      border: '1px solid var(--status-warning-border)',
    },
    info: {
      background: 'var(--status-info-bg)',
      color: 'var(--status-info-text)',
      border: '1px solid var(--status-info-border)',
    },
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        borderRadius: 'var(--radius-full)',
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={removeLabel}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'inherit',
            opacity: 0.7,
            marginLeft: '2px',
            width: '20px',
            height: '20px',
            minWidth: '20px',
            minHeight: '20px',
            borderRadius: '50%',
            transition: 'opacity var(--transition-fast), background var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </span>
  )
}
