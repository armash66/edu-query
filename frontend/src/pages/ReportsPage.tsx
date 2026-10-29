import React, { useState } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { FileText, Download, Award, AlertCircle, Shield, FileCheck } from 'lucide-react'

export const ReportsPage: React.FC = () => {
  const [anonymized, setAnonymized] = useState(false)

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
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
            <FileText size={14} />
            <span>Official Academic Documentation</span>
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
            Institutional Reports & Exports
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Generate print-ready executive summaries, merit lists, result slips, and department briefs.
          </p>
        </div>

        {/* Anonymization Toggle */}
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={anonymized}
            onChange={(e) => setAnonymized(e.target.checked)}
            style={{ accentColor: 'var(--action-primary-bg)' }}
          />
          <Shield size={14} />
          <span>Anonymize Exports (Roll Numbers Only)</span>
        </label>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* HOD Executive Brief */}
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <FileCheck size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                HOD Executive Brief
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                One-page leadership report for Department Head
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Synthesizes cohort pass rate (91.0%), division comparison (Div A 88.2% vs Div B 95.0%), hardest subject (PCEC12T), and action items.
          </p>
          <Button size="sm" variant="primary" icon={<Download size={14} />}>
            Generate HOD Brief
          </Button>
        </GlassCard>

        {/* Merit List */}
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                Cohort Merit List
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Ranked by CGPA / SGPI with documented tie-breaking
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Full cohort academic ranking with Division A and Division B rank breakouts and university distinction markers.
          </p>
          <Button size="sm" variant="secondary" icon={<Download size={14} />}>
            Export Merit List (Excel)
          </Button>
        </GlassCard>

        {/* Failed & Absent Lists */}
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-danger-text)',
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                Backlog & Absentee Roster
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Official exam cell action list
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Consolidated 13 failed students and 7 absent students with exact subject failure codes and re-examination status.
          </p>
          <Button size="sm" variant="secondary" icon={<Download size={14} />}>
            Export Backlog Roster
          </Button>
        </GlassCard>

        {/* Result Slips PDF */}
        <GlassCard variant="glass-1" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-3)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                Bulk Result Slips (PDF)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Printable grade sheets per student / division
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Formatted individual result slips containing student marks, component breakdown, SGPI/CGPA, and university stamps.
          </p>
          <Button size="sm" variant="secondary" icon={<Download size={14} />}>
            Generate Division Slips
          </Button>
        </GlassCard>
      </div>
    </div>
  )
}
export default ReportsPage

