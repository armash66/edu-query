import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

interface GlobalSearchTriggerProps {
  onClick: () => void
}

export const GlobalSearchTrigger: React.FC<GlobalSearchTriggerProps> = ({ onClick }) => {
  const [isMac, setIsMac] = useState(false)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    try {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.userAgent || navigator.platform))
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
    } catch {
      // Ignore
    }
  }, [])

  return (
    <>
      {/* Desktop Search Trigger (>= 1024px) */}
      <button
        type="button"
        onClick={onClick}
        className="global-search-desktop"
        style={{
          display: 'none',
          position: 'relative',
          alignItems: 'center',
          width: '320px',
          height: '38px',
          borderRadius: 'var(--radius-input)',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          padding: '0 48px 0 36px',
          textAlign: 'left',
          transition: 'all var(--transition-fast)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <Search size={15} />
        </span>

        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--text-muted)',
          }}
        >
          Search students or subjects
        </span>

        {!isTouch && (
          <kbd
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--surface-active)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              lineHeight: 1.2,
            }}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        )}
      </button>

      {/* Collapsed Search Icon Button (< 1024px) */}
      <button
        type="button"
        onClick={onClick}
        className="global-search-mobile touch-target-44"
        aria-label="Search students or subjects"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Search size={16} />
      </button>
    </>
  )
}
