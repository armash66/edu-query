import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  children?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      disabled,
      className = '',
      style,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: {
        height: '32px',
        padding: '0 var(--space-3)',
        fontSize: 'var(--text-xs)',
        gap: 'var(--space-2)',
        borderRadius: 'var(--radius-sm)',
      },
      md: {
        height: '40px',
        padding: '0 var(--space-4)',
        fontSize: 'var(--text-sm)',
        gap: 'var(--space-2)',
        borderRadius: 'var(--radius-input)',
      },
      lg: {
        height: '48px',
        padding: '0 var(--space-6)',
        fontSize: 'var(--text-base)',
        gap: 'var(--space-3)',
        borderRadius: 'var(--radius-input)',
      },
    }

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: 'var(--action-primary-bg)',
        color: 'var(--action-primary-text)',
        border: '1px solid transparent',
        fontWeight: 600,
        boxShadow: 'var(--shadow-sm)',
      },
      secondary: {
        background: 'var(--action-secondary-bg)',
        color: 'var(--action-secondary-text)',
        border: '1px solid var(--action-secondary-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontWeight: 500,
      },
      ghost: {
        background: 'transparent',
        color: 'var(--text)',
        border: '1px solid transparent',
        fontWeight: 500,
      },
      danger: {
        background: 'var(--status-danger-bg)',
        color: 'var(--status-danger-text)',
        border: '1px solid var(--status-danger-border)',
        fontWeight: 600,
      },
    }

    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading ? 'true' : undefined}
        className={`btn-interactive ${className}`.trim()}
        style={{
          display: fullWidth ? 'flex' : 'inline-flex',
          width: fullWidth ? '100%' : 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          minHeight: '44px', // WCAG 44px touch target hitbox standard
          ...sizeStyles[size],
          ...variantStyles[variant],
          ...style,
        }}
        {...props}
      >
        {loading && (
          <svg
            aria-hidden="true"
            style={{
              width: size === 'sm' ? '14px' : '16px',
              height: size === 'sm' ? '14px' : '16px',
              animation: 'spin 1s linear infinite',
              marginRight: children ? 'var(--space-2)' : 0,
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
        )}
        {!loading && icon && iconPosition === 'left' && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
            {icon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
