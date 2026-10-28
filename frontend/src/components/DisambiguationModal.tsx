import React from 'react'
import { AlertCircle, ArrowRight, User } from 'lucide-react'
import type { CandidateSummary } from '../api/types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export interface DisambiguationModalProps {
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
  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertCircle size={18} style={{ color: 'var(--status-warning-text)' }} />
          <span>Multiple Students Matched</span>
        </div>
      }
      description={`Query "${query}" matched multiple student records. Select candidate:`}
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {candidates.map((cand) => (
          <button
            key={cand.student_id}
            type="button"
            className="data-surface"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              textAlign: 'left',
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface-data)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => onSelect(cand)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)'
              e.currentTarget.style.background = 'var(--surface-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface-data)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--surface-hover)',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
                  {cand.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ID: {cand.student_id}
                  {cand.roll_no ? ` • Roll: ${cand.roll_no}` : ''}
                  {cand.seat_no ? ` • Seat: ${cand.seat_no}` : ''}
                  {cand.division ? ` • Div: ${cand.division}` : ''}
                </div>
              </div>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Modal>
  )
}
