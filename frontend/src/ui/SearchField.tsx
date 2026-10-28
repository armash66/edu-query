import React, { useEffect, useRef } from 'react'
import { Input, type InputProps } from './Input'

export interface SearchFieldProps extends Omit<InputProps, 'prefixIcon'> {
  shortcut?: string
  onShortcutTrigger?: () => void
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      shortcut = 'Ctrl+K',
      onShortcutTrigger,
      placeholder = 'Search...',
      value,
      onChange,
      onClear,
      clearable = true,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null)
    const combinedRef = (ref || internalRef) as React.RefObject<HTMLInputElement | null>

    const isMac =
      typeof window !== 'undefined' &&
      navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const displayShortcut = isMac ? '⌘K' : shortcut

    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault()
          if (onShortcutTrigger) {
            onShortcutTrigger()
          } else if (combinedRef.current) {
            combinedRef.current.focus()
            combinedRef.current.select()
          }
        }
      }

      window.addEventListener('keydown', handleGlobalKeyDown)
      return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [combinedRef, onShortcutTrigger])

    const searchIcon = (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )

    const shortcutPill = shortcut ? (
      <kbd
        style={{
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          background: 'var(--surface-active)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xs)',
          padding: '2px 5px',
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {displayShortcut}
      </kbd>
    ) : undefined

    return (
      <Input
        ref={combinedRef}
        type="search"
        role="searchbox"
        placeholder={placeholder}
        prefixIcon={searchIcon}
        suffixIcon={!value ? shortcutPill : undefined}
        clearable={clearable}
        value={value}
        onChange={onChange}
        onClear={onClear}
        {...props}
      />
    )
  }
)

SearchField.displayName = 'SearchField'
