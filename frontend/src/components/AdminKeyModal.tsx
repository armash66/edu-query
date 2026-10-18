import React, { useState } from 'react'
import { KeyRound, X, ShieldAlert, CheckCircle, Trash2 } from 'lucide-react'
import { useAdminKey } from '../context/AdminKeyContext'

interface AdminKeyModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AdminKeyModal: React.FC<AdminKeyModalProps> = ({ isOpen, onClose }) => {
  const { adminKey, setAdminKey, clearAdminKey, hasAdminKey } = useAdminKey()
  const [inputValue, setInputValue] = useState(adminKey || '')
  const [savedSuccess, setSavedSuccess] = useState(false)

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setAdminKey(inputValue.trim())
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 700)
    }
  }

  const handleDisconnect = () => {
    clearAdminKey()
    setInputValue('')
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-key-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={20} style={{ color: '#2563eb' }} />
            <h3 id="admin-key-title" className="modal-title">Administrative Import Key</h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem' }}>
                <strong>Session Security Policy:</strong> This administrative key is kept{' '}
                <em>in memory only</em> for the active browser session. It is never written to
                LocalStorage, cookies, or browser logs, and is sent exclusively to workbook upload and
                activation endpoints.
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="admin-key-input"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: '#1e293b' }}
              >
                Enter Admin Key (configured via EDUQUERY_IMPORT_API_KEY)
              </label>
              <input
                id="admin-key-input"
                type="password"
                className="form-control"
                placeholder="Paste administrative import key..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoComplete="off"
                required
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Note: In production multi-tenant environments, this single-key mechanism will be superseded by OAuth2/RBAC.
              </span>
            </div>

            {hasAdminKey && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065f46' }}>
                  <CheckCircle size={16} style={{ color: '#10b981' }} />
                  <span>Key currently active in browser memory</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnect}
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={12} /> Clear Key
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!inputValue.trim()}
            >
              {savedSuccess ? 'Saved!' : 'Save Key in Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
