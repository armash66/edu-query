import React from 'react'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon: React.ReactNode
  active?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      icon,
      active = false,
      disabled,
      className = '',
      style,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const sizeMap = {
      sm: { dimension: '32px', iconSize: '16px', radius: 'var(--radius-sm)' },
      md: { dimension: '40px', iconSize: '18px', radius: 'var(--radius-input)' },
      lg: { dimension: '48px', iconSize: '22px', radius: 'var(--radius-card)' },
    }

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'var(--action-primary-bg)',
        color: 'var(--action-primary-text)',
        border: '1px solid transparent',
      },
      secondary: {
        background: 'var(--action-secondary-bg)',
        color: 'var(--action-secondary-text)',
        border: '1px solid var(--action-secondary-border)',
      },
      ghost: {
        background: active ? 'var(--surface-active)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-secondary)',
        border: '1px solid transparent',
      },
      danger: {
        background: 'var(--status-danger-bg)',
        color: 'var(--status-danger-text)',
        border: '1px solid var(--status-danger-border)',
      },
    }

    const { dimension, iconSize, radius } = sizeMap[size]

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-label={ariaLabel}
        title={props.title || ariaLabel}
        className={`touch-target-44 ${className}`.trim()}
        style={{
          width: dimension,
          height: dimension,
          minWidth: '44px',
          minHeight: '44px',
          padding: 0,
          borderRadius: radius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'all var(--transition-fast)',
          ...variantStyles[variant],
          ...style,
        }}
        {...props}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: iconSize,
            width: iconSize,
            height: iconSize,
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
