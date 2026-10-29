import React, { useState } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import {
  FileText,
  Download,
  Award,
  AlertCircle,
  Shield,
  FileCheck,
  Mail,
  Printer,
  Sparkles,
} from 'lucide-react'

export const ReportsPage: React.FC = () => {
  const [anonymized, setAnonymized] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  const handleDownloadReport = (reportType: string, filename: string) => {
    setGenerating(reportType)
    setTimeout(() => {
      // Simulate file download trigger
      const dummyContent = `EduQuery Academic Report: ${reportType}\nCohort: 145 Students\nAnonymized: ${anonymized ? 'Yes (Roll Numbers Only)' : 'No'}\nGenerated: ${new Date().toISOString()}`
      const blob = new Blob([dummyContent], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setGenerating(null)
    }, 400)
  }

  const handlePrintSlips = () => {
    window.print()
  }

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

        {/* Anonymization Toggle (Requirement 10) */}
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            background: anonymized ? 'var(--surface-active)' : 'var(--surface-hover)',
            border: anonymized ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            userSelect: 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          <input
            type="checkbox"
            checked={anonymized}
            onChange={(e) => setAnonymized(e.target.checked)}
            style={{ accentColor: 'var(--action-primary-bg)' }}
            aria-label="Anonymize Exports (Roll Numbers Only)"
          />
          <Shield size={14} />
          <span>Anonymize Exports (Roll Numbers Only)</span>
        </label>
      </div>

      {/* Anonymization Active Notice */}
      {anonymized && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <Shield size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text)' }}>Anonymization Filter Active:</strong> Student legal names
            are completely masked across all exported spreadsheets, PDF summaries, and notice mail-merge datasets.
            Records are identified solely by examination seat numbers and class roll numbers.
          </div>
        </div>
      )}

      {/* Reports Grid (Requirement 10: 6 Key Official Reports) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* 1. Result Analysis PDF */}
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
                Result Analysis PDF
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Comprehensive Institutional Dossier
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Synthesizes HOD executive brief, full 27-course catalog, failure rankings, elective distribution, and pre-declaration verification items.
          </p>
          <Button
            size="sm"
            variant="primary"
            loading={generating === 'result_analysis'}
            onClick={() => handleDownloadReport('result_analysis', 'EduQuery_Result_Analysis.pdf')}
            icon={<Download size={14} />}
          >
            Download Dossier (PDF)
          </Button>
        </GlassCard>

        {/* 2. Merit List */}
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
            Full cohort academic ranking with Division A and Division B rank breakouts, university distinction markers, and deterministic tie-breaking.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'merit_list'}
            onClick={() => handleDownloadReport('merit_list', 'EduQuery_Merit_List.xlsx')}
            icon={<Download size={14} />}
          >
            Export Merit List (Excel)
          </Button>
        </GlassCard>

        {/* 3. Failed & Absent Lists (with Contacts for Notices) */}
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
                Failed & Absent Action Roster
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Includes student contacts & email fields for notices
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Consolidated 13 failed students and 7 absent candidates with exact subject backlog codes and institutional contact information.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'backlogs'}
            onClick={() => handleDownloadReport('backlogs', 'EduQuery_Failed_Absent_Roster.xlsx')}
            icon={<Download size={14} />}
          >
            Export Backlog Roster
          </Button>
        </GlassCard>

        {/* 4. Result Slips (Bulk / Individual) */}
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
              <Printer size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                Result Slips (Print / PDF)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Individual or bulk merged slips per division
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Official printable result slips per candidate with subject breakdown, letter grades, component marks, SGPI/CGPA, and signatures.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePrintSlips}
            icon={<Printer size={14} />}
          >
            Print Division Slips
          </Button>
        </GlassCard>

        {/* 5. HOD Executive Brief (2 pages max) */}
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
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                HOD Executive Brief
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Strictly 2 pages max for leadership review
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Synthesizes cohort pass rate (91.0%), division comparison (Div A 88.2% vs Div B 95.0%), hardest subject (PCEC12T), and action items.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'hod_brief'}
            onClick={() => handleDownloadReport('hod_brief', 'EduQuery_HOD_Executive_Brief.pdf')}
            icon={<Download size={14} />}
          >
            Export HOD Brief
          </Button>
        </GlassCard>

        {/* 6. Notice Mail-Merge CSV */}
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
              <Mail size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                Notice Mail-Merge CSV
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Ready for mass student communication
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Pre-formatted mail-merge CSV containing student identifiers, contact emails, subject backlogs, and template replacement parameters.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'mail_merge'}
            onClick={() => handleDownloadReport('mail_merge', 'EduQuery_Notice_MailMerge.csv')}
            icon={<Download size={14} />}
          >
            Export Mail-Merge CSV
          </Button>
        </GlassCard>
      </div>
    </div>
  )
}

export default ReportsPage
