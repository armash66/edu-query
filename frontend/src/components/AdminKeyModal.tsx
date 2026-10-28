import React, { useState } from 'react'
import { KeyRound, ShieldAlert, CheckCircle, Trash2 } from 'lucide-react'
import { useAdminKey } from '../context/AdminKeyContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export interface AdminKeyModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AdminKeyModal: React.FC<AdminKeyModalProps> = ({ isOpen, onClose }) => {
  const { adminKey, setAdminKey, clearAdminKey, hasAdminKey } = useAdminKey()
  const [inputValue, setInputValue] = useState(adminKey || '')
  const [savedSuccess, setSavedSuccess] = useState(false)

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      setAdminKey(inputValue.trim())
      setSavedSuccess(true)
      setTimeout(() => {
        setSavedSuccess(false)
        onClose()
      }, 600)
    }
  }

  const handleDisconnect = () => {
    clearAdminKey()
    setInputValue('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <KeyRound size={18} style={{ color: 'var(--text)' }} />
          <span>Administrative Import Key</span>
        </div>
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!inputValue.trim()}
          >
            {savedSuccess ? 'Saved!' : 'Save Key in Memory'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div
          className="glass-1"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text)' }} />
          <div>
            <strong>Session Security Policy:</strong> This key is kept in browser memory only for
            the active session. It is never written to LocalStorage, cookies, or browser logs, and is
            sent exclusively to workbook promotion and dataset endpoints.
          </div>
        </div>

        <Input
          id="admin-key-input"
          label="Enter Admin Key (configured via EDUQUERY_IMPORT_API_KEY)"
          type="password"
          placeholder="Paste administrative import key..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoComplete="off"
          required
          fullWidth
          hint="Note: Single-key mechanism for protected import operations."
        />

        {hasAdminKey && (
          <div
            className="glass-1"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--status-success-border)',
              background: 'var(--status-success-bg)',
              fontSize: 'var(--text-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--status-success-text)', fontWeight: 600 }}>
              <CheckCircle size={15} />
              <span>Key currently active in browser memory</span>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDisconnect}
              icon={<Trash2 size={13} />}
            >
              Clear Key
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
