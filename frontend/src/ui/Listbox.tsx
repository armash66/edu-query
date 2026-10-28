import React, { useState, useRef, useEffect, useId } from 'react'

export interface ListboxOption<T extends string = string> {
  value: T
  label: string
  sublabel?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface ListboxProps<T extends string = string> {
  options: ListboxOption<T>[]
  value: T | ''
  onChange: (value: T) => void
  placeholder?: string
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
}

export const Listbox = <T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  label,
  error,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className = '',
  style,
  ariaLabel,
}: ListboxProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const generatedId = useId()
  const listboxId = `listbox-${generatedId}`
  const labelId = `listbox-label-${generatedId}`

  const selectedOption = options.find((opt) => opt.value === value)

  const sizeStyles = {
    sm: { height: '32px', fontSize: 'var(--text-xs)', padding: '0 var(--space-3)' },
    md: { height: '40px', fontSize: 'var(--text-sm)', padding: '0 var(--space-4)' },
    lg: { height: '48px', fontSize: 'var(--text-base)', padding: '0 var(--space-4)' },
  }

  // Click outside to close
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDown)
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen])

  // Open with current selected highlighted
  const handleOpen = () => {
    if (disabled) return
    const idx = options.findIndex((opt) => opt.value === value)
    setHighlightedIndex(idx >= 0 ? idx : 0)
    setIsOpen(true)
  }

  const handleSelect = (val: T) => {
    onChange(val)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleOpen()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          let next = (prev + 1) % options.length
          while (options[next]?.disabled && next !== prev) {
            next = (next + 1) % options.length
          }
          return next
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          let next = (prev - 1 + options.length) % options.length
          while (options[next]?.disabled && next !== prev) {
            next = (next - 1 + options.length) % options.length
          }
          return next
        })
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (highlightedIndex >= 0 && options[highlightedIndex] && !options[highlightedIndex].disabled) {
          handleSelect(options[highlightedIndex].value)
        }
        break
      case 'Home':
        e.preventDefault()
        setHighlightedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setHighlightedIndex(options.length - 1)
        break
      default:
        // Type-ahead match
        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          const char = e.key.toLowerCase()
          const matchedIdx = options.findIndex(
            (opt, idx) =>
              idx > highlightedIndex &&
              opt.label.toLowerCase().startsWith(char) &&
              !opt.disabled
          )
          if (matchedIdx >= 0) {
            setHighlightedIndex(matchedIdx)
          } else {
            const firstMatch = options.findIndex(
              (opt) => opt.label.toLowerCase().startsWith(char) && !opt.disabled
            )
            if (firstMatch >= 0) setHighlightedIndex(firstMatch)
          }
        }
        break
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
        gap: 'var(--space-1)',
        position: 'relative',
        ...style,
      }}
      className={className}
    >
      {label && (
        <span
          id={labelId}
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: error ? 'var(--status-danger-text)' : 'var(--text-secondary)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        id={`${listboxId}-trigger`}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={label ? labelId : undefined}
        aria-label={!label ? ariaLabel || placeholder : undefined}
        aria-invalid={error ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        onKeyDown={handleKeyDown}
        className="data-surface"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          borderRadius: 'var(--radius-input)',
          border: `1px solid ${error ? 'var(--status-danger-border)' : 'var(--border)'}`,
          color: selectedOption ? 'var(--text)' : 'var(--text-muted)',
          background: 'var(--surface-data)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          ...sizeStyles[size],
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: 'inline-flex' }} aria-hidden="true">
              {selectedOption.icon}
            </span>
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>

        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast)',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <polyline points="4 6 8 10 12 6" />
        </svg>
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={label || ariaLabel || placeholder}
          className="glass-3"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-1))',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: '260px',
            overflowY: 'auto',
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-input)',
            listStyle: 'none',
            margin: 0,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value
            const isHighlighted = idx === highlightedIndex

            return (
              <li
                key={option.value}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  cursor: option.disabled ? 'not-allowed' : 'pointer',
                  opacity: option.disabled ? 0.4 : 1,
                  background: isHighlighted
                    ? 'var(--surface-hover)'
                    : isSelected
                    ? 'var(--surface-active)'
                    : 'transparent',
                  color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {option.icon && (
                    <span style={{ display: 'inline-flex' }} aria-hidden="true">
                      {option.icon}
                    </span>
                  )}
                  <div>
                    <div>{option.label}</div>
                    {option.sublabel && (
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {option.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--text)', flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <polyline points="3 8.5 6.5 12 13 4.5" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
