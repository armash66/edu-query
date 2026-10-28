import React, { useRef } from 'react'

export interface SegmentedOption<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
  fullWidth?: boolean
  className?: string
  style?: React.CSSProperties
}

export const SegmentedControl = <T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel = 'Segmented options',
  fullWidth = false,
  className = '',
  style,
}: SegmentedControlProps<T>): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null)

  const sizeStyles = {
    sm: { height: '32px', padding: '2px', fontSize: 'var(--text-xs)', gap: '2px' },
    md: { height: '40px', padding: '4px', fontSize: 'var(--text-sm)', gap: '4px' },
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledOptions = options.filter((opt) => !opt.disabled)
    const currentEnabledIdx = enabledOptions.findIndex(
      (opt) => opt.value === options[currentIndex].value
    )

    let nextOpt: SegmentedOption<T> | undefined

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextOpt = enabledOptions[(currentEnabledIdx + 1) % enabledOptions.length]
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextOpt =
        enabledOptions[(currentEnabledIdx - 1 + enabledOptions.length) % enabledOptions.length]
    }

    if (nextOpt) {
      onChange(nextOpt.value)
      const btn = containerRef.current?.querySelector<HTMLButtonElement>(
        `[data-value="${nextOpt.value}"]`
      )
      btn?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`glass-1 ${className}`.trim()}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-input)',
        background: 'var(--surface-hover)',
        border: '1px solid var(--border)',
        width: fullWidth ? '100%' : 'auto',
        ...sizeStyles[size],
        ...style,
      }}
    >
      {options.map((option, idx) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              flex: fullWidth ? 1 : 'initial',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              height: '100%',
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: isSelected ? 'var(--action-primary-bg)' : 'transparent',
              color: isSelected
                ? 'var(--action-primary-text)'
                : 'var(--text-secondary)',
              fontWeight: isSelected ? 600 : 500,
              cursor: option.disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
              userSelect: 'none',
            }}
          >
            {option.icon && (
              <span style={{ display: 'inline-flex' }} aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
