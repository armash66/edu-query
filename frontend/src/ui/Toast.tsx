import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warn'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  description?: string
  durationMs?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (toast: Omit<ToastItem, 'id'>) => string
  dismissToast: (id: string) => void
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  warn: (title: string, description?: string) => string
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ type, title, description, durationMs = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const newItem: ToastItem = { id, type, title, description, durationMs }

      setToasts((prev) => [...prev, newItem])
      return id
    },
    []
  )

  const success = useCallback(
    (title: string, description?: string) => showToast({ type: 'success', title, description }),
    [showToast]
  )

  const error = useCallback(
    (title: string, description?: string) => showToast({ type: 'error', title, description }),
    [showToast]
  )

  const info = useCallback(
    (title: string, description?: string) => showToast({ type: 'info', title, description }),
    [showToast]
  )

  const warn = useCallback(
    (title: string, description?: string) => showToast({ type: 'warn', title, description }),
    [showToast]
  )

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        success,
        error,
        info,
        warn,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

const ToastContainer: React.FC<{
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        maxWidth: '380px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}

const ToastCard: React.FC<{
  toast: ToastItem
  onDismiss: () => void
}> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (isPaused || !toast.durationMs) return

    timerRef.current = setTimeout(() => {
      onDismiss()
    }, toast.durationMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isPaused, toast.durationMs, onDismiss])

  const iconMap: Record<ToastType, React.ReactNode> = {
    success: (
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="var(--status-success-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 8.5 6.5 12 13 4.5" />
      </svg>
    ),
    error: (
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="var(--status-danger-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="5" x2="8" y2="8" />
        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
      </svg>
    ),
    warn: (
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="var(--status-warning-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 2.5L1.5 13.5h13L8 2.5z" />
        <line x1="8" y1="7" x2="8" y2="9.5" />
        <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
      </svg>
    ),
    info: (
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="var(--text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="7" x2="8" y2="11" />
        <circle cx="8" cy="4.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  }

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="glass-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        pointerEvents: 'auto',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-strong)',
        animation: 'slideUp 200ms ease-out',
      }}
    >
      <div style={{ marginTop: '2px', flexShrink: 0 }}>{iconMap[toast.type]}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>
          {toast.title}
        </div>
        {toast.description && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-1)',
            }}
          >
            {toast.description}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="touch-target-44"
        style={{
          width: '28px',
          height: '28px',
          minWidth: '28px',
          minHeight: '28px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 16 16"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}
