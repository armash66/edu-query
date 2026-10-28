import React, { useId } from 'react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  prefixIcon?: React.ReactNode
  suffixIcon?: React.ReactNode
  clearable?: boolean
  onClear?: () => void
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      prefixIcon,
      suffixIcon,
      clearable,
      onClear,
      size = 'md',
      fullWidth = false,
      value,
      disabled,
      className = '',
      style,
      id: customId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const inputId = customId || generatedId
    const hintId = `${inputId}-hint`
    const errorId = `${inputId}-error`

    const sizeStyles = {
      sm: { height: '32px', fontSize: 'var(--text-xs)', padding: '0 var(--space-3)' },
      md: { height: '40px', fontSize: 'var(--text-sm)', padding: '0 var(--space-4)' },
      lg: { height: '48px', fontSize: 'var(--text-base)', padding: '0 var(--space-4)' },
    }

    const hasValue = value !== undefined && value !== ''

    return (
      <div
        style={{
          display: fullWidth ? 'flex' : 'inline-flex',
          flexDirection: 'column',
          width: fullWidth ? '100%' : 'auto',
          gap: 'var(--space-1)',
        }}
      >
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: error ? 'var(--status-danger-text)' : 'var(--text-secondary)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </label>
        )}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {prefixIcon && (
            <span
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            >
              {prefixIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            value={value}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            className={`data-surface ${className}`.trim()}
            style={{
              width: '100%',
              borderRadius: 'var(--radius-input)',
              border: `1px solid ${error ? 'var(--status-danger-border)' : 'var(--border)'}`,
              paddingLeft: prefixIcon ? 'var(--space-8)' : sizeStyles[size].padding.split(' ')[1],
              paddingRight:
                clearable && hasValue
                  ? 'var(--space-12)'
                  : suffixIcon
                  ? 'var(--space-8)'
                  : sizeStyles[size].padding.split(' ')[1],
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              background: 'var(--surface-data)',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
              outline: 'none',
              ...sizeStyles[size],
              ...style,
            }}
            {...props}
          />

          <div
            style={{
              position: 'absolute',
              right: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            {clearable && hasValue && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear input"
                className="touch-target-44"
                style={{
                  width: '24px',
                  height: '24px',
                  minWidth: '24px',
                  minHeight: '24px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '50%',
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}

            {suffixIcon && (
              <span
                style={{
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingRight: 'var(--space-2)',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              >
                {suffixIcon}
              </span>
            )}
          </div>
        </div>

        {error && (
          <span
            id={errorId}
            role="alert"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--status-danger-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" />
              <line x1="8" y1="5" x2="8" y2="8" />
              <circle cx="8" cy="11" r="0.5" fill="currentColor" />
            </svg>
            {error}
          </span>
        )}

        {!error && hint && (
          <span
            id={hintId}
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
