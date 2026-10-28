import React, { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Laptop, Check } from 'lucide-react'
import { useTheme, type ThemePreference } from '../context/ThemeContext'

interface ThemeMenuProps {
  align?: 'left' | 'right' | 'top'
  direction?: 'down' | 'up'
}

export const ThemeMenu: React.FC<ThemeMenuProps> = ({ align = 'right', direction = 'down' }) => {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const options: { mode: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { mode: 'system', label: 'System', icon: <Laptop size={14} /> },
    { mode: 'light', label: 'Light', icon: <Sun size={14} /> },
    { mode: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  ]

  const currentIcon =
    theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Laptop size={16} />

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Theme: currently ${theme}. Click to change theme.`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="touch-target-44"
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
        {currentIcon}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="glass-3"
          style={{
            position: 'absolute',
            ...(direction === 'up' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            minWidth: '140px',
            borderRadius: 'var(--radius-md)',
            padding: '4px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt) => {
            const isSelected = theme === opt.mode
            return (
              <button
                key={opt.mode}
                role="menuitem"
                type="button"
                onClick={() => {
                  setTheme(opt.mode)
                  setIsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isSelected ? 'var(--action-primary-bg)' : 'transparent',
                  color: isSelected ? 'var(--action-primary-text)' : 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

