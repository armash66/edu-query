import React from 'react'
import { AlertCircle, X, ArrowRight, User } from 'lucide-react'
import type { CandidateSummary } from '../api/types'

interface DisambiguationModalProps {
  isOpen?: boolean
  query: string
  candidates: CandidateSummary[]
  onSelect: (candidate: CandidateSummary) => void
  onClose: () => void
}

export const DisambiguationModal: React.FC<DisambiguationModalProps> = ({
  isOpen = true,
  query,
  candidates,
  onSelect,
  onClose,
}) => {
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

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disambiguation-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} style={{ color: '#f59e0b' }} />
            <h3 id="disambiguation-title" className="modal-title">Multiple Students Matched</h3>
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

        <div className="modal-body">
          <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
            Your query <strong style={{ color: '#0f172a' }}>"{query}"</strong> matched multiple student records.
            Please explicitly select the correct student below:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {candidates.map((cand) => (
              <button
                key={cand.student_id}
                type="button"
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  textAlign: 'left',
                  width: '100%',
                }}
                onClick={() => onSelect(cand)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                      {cand.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                      ID: <span style={{ fontFamily: 'monospace' }}>{cand.student_id}</span>
                      {cand.roll_no ? ` • Roll: ${cand.roll_no}` : ''}
                      {cand.seat_no ? ` • Seat: ${cand.seat_no}` : ''}
                      {cand.division ? ` • Div: ${cand.division}` : ''}
                    </div>
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
