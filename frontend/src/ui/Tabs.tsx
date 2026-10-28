import React, { useRef } from 'react'

export interface TabItem {
  id: string
  label: string
  count?: number | string
  icon?: React.ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  variant?: 'pills' | 'line'
  ariaLabel?: string
  className?: string
  style?: React.CSSProperties
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'pills',
  ariaLabel = 'Navigation Tabs',
  className = '',
  style,
}) => {
  const tabListRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledItems = items.filter((item) => !item.disabled)
    const currentEnabledIndex = enabledItems.findIndex((item) => item.id === items[index].id)

    let nextItem: TabItem | undefined

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextItem = enabledItems[(currentEnabledIndex + 1) % enabledItems.length]
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextItem =
        enabledItems[(currentEnabledIndex - 1 + enabledItems.length) % enabledItems.length]
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextItem = enabledItems[0]
    } else if (e.key === 'End') {
      e.preventDefault()
      nextItem = enabledItems[enabledItems.length - 1]
    }

    if (nextItem) {
      onChange(nextItem.id)
      const tabButton = tabListRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-id="${nextItem.id}"]`
      )
      tabButton?.focus()
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: variant === 'pills' ? 'var(--space-2)' : 'var(--space-6)',
        borderBottom: variant === 'line' ? '1px solid var(--border)' : 'none',
        padding: variant === 'pills' ? 'var(--space-1)' : '0',
        background: variant === 'pills' ? 'var(--surface-hover)' : 'transparent',
        borderRadius: variant === 'pills' ? 'var(--radius-input)' : '0',
        overflowX: 'auto',
        maxWidth: '100%',
        ...style,
      }}
    >
      {items.map((item, index) => {
        const isSelected = item.id === activeId

        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            data-tab-id={item.id}
            id={`tab-${item.id}`}
                        aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontWeight: isSelected ? 600 : 500,
              padding:
                variant === 'pills'
                  ? 'var(--space-2) var(--space-4)'
                  : 'var(--space-3) 0',
              borderRadius: variant === 'pills' ? 'var(--radius-sm)' : 0,
              border: 'none',
              borderBottom:
                variant === 'line'
                  ? isSelected
                    ? '2px solid var(--text)'
                    : '2px solid transparent'
                  : 'none',
              background:
                variant === 'pills'
                  ? isSelected
                    ? 'var(--surface-card)'
                    : 'transparent'
                  : 'transparent',
              color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow:
                variant === 'pills' && isSelected ? 'var(--shadow-sm)' : 'none',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)',
              position: 'relative',
              marginBottom: variant === 'line' ? '-1px' : 0,
            }}
          >
            {item.icon && (
              <span style={{ display: 'inline-flex' }} aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected
                    ? 'var(--action-primary-bg)'
                    : 'var(--surface-active)',
                  color: isSelected
                    ? 'var(--action-primary-text)'
                    : 'var(--text-secondary)',
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
