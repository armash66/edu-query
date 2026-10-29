import React, { useState } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { StatusBadge } from '../ui/StatusBadge'
import { Users, Mail, UserCheck, AlertCircle } from 'lucide-react'

export const FollowUpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'failed' | 'remedial' | 'notices'>('failed')

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: '0 var(--space-4) var(--space-12)',
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
            marginBottom: '4px',
          }}
        >
          <UserCheck size={14} />
          <span>Action & Intervention</span>
        </div>
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 var(--space-1) 0',
            letterSpacing: '-0.02em',
          }}
        >
          Follow-ups & Remedial Management
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Manage backlog students, coordinate remedial peer mentoring groups, and draft faculty notices.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('failed')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'failed' ? 'var(--action-primary-bg)' : 'transparent',
            color: activeTab === 'failed' ? 'var(--action-primary-text)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={15} />
          <span>Failed Students (13)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('remedial')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'remedial' ? 'var(--action-primary-bg)' : 'transparent',
            color: activeTab === 'remedial' ? 'var(--action-primary-text)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={15} />
          <span>Remedial Peer Pairing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'notices' ? 'var(--action-primary-bg)' : 'transparent',
            color: activeTab === 'notices' ? 'var(--action-primary-text)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Mail size={15} />
          <span>Intervention Notices</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'failed' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
          <GlassCard variant="glass-1" padding="lg">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                1–3 Subject Backlogs (ATKT Eligible)
              </div>
              <StatusBadge tone="warn" size="sm" label="7 Students" />
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
              Students who failed 1 to 3 subjects. Recommended for immediate remedial tutorial and peer study pairing.
            </p>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Configurable university pass rule: Inferred from institutional marksheet schema.
            </div>
          </GlassCard>

          <GlassCard variant="glass-1" padding="lg">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                4+ Subject Backlogs (Critical Review)
              </div>
              <StatusBadge tone="fail" size="sm" label="6 Students" />
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
              Students with comprehensive backlog status (7–12 subjects). Requires formal academic counselling and parent communication.
            </p>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Credits pending review: 24+ credits requiring re-enrollment.
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'remedial' && (
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)', marginBottom: 'var(--space-2)' }}>
            Deterministic Peer Mentoring Assignment
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
            Matches struggling students in each subject with high-performing peers from their own division using deterministic score ranking.
          </p>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Peer matching algorithm active for PCEC12T (12 struggling students) and core subjects.
          </div>
        </GlassCard>
      )}

      {activeTab === 'notices' && (
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)', marginBottom: 'var(--space-2)' }}>
            Faculty & Student Notices
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
            Choose notice template: Failed subjects notification, Absentee follow-up, or Merit congratulations. Export mail-merge CSV.
          </p>
        </GlassCard>
      )}
    </div>
  )
}
export default FollowUpsPage

