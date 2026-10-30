import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  Check,
} from 'lucide-react'
import {
  downloadMeritListExcel,
  downloadBacklogsExcel,
  downloadMailMergeCsv,
  downloadAnalysisDossier,
  downloadStudentSlipsPdf,
  getHodBrief,
  getDivisionStudentSlips,
  saveBlobAsFile,
} from '../api/client'
import type { StudentSlip } from '../api/types'

export const ReportsPage: React.FC = () => {
  const [anonymized, setAnonymized] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Slips Printing State
  const slipsLoading = false
  const [loadedSlips, setLoadedSlips] = useState<StudentSlip[]>([])

  useEffect(() => {
    getDivisionStudentSlips('', anonymized)
      .then((res) => {
        if (res?.slips) setLoadedSlips(res.slips)
      })
      .catch(() => {})
  }, [anonymized])

  const notifySuccess = (type: string) => {
    setDownloadSuccess(type)
    setTimeout(() => setDownloadSuccess(null), 3000)
  }

  const handleDownloadMeritList = async () => {
    setGenerating('merit_list')
    setErrorMsg(null)
    try {
      await downloadMeritListExcel(anonymized)
      notifySuccess('merit_list')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download merit list workbook')
    } finally {
      setGenerating(null)
    }
  }

  const handleDownloadBacklogs = async () => {
    setGenerating('backlogs')
    setErrorMsg(null)
    try {
      await downloadBacklogsExcel(anonymized)
      notifySuccess('backlogs')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download backlog roster workbook')
    } finally {
      setGenerating(null)
    }
  }

  const handleDownloadMailMerge = async () => {
    setGenerating('mail_merge')
    setErrorMsg(null)
    try {
      await downloadMailMergeCsv(anonymized)
      notifySuccess('mail_merge')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download mail-merge CSV')
    } finally {
      setGenerating(null)
    }
  }

  const handleDownloadAnalysis = async () => {
    setGenerating('analysis')
    setErrorMsg(null)
    try {
      await downloadAnalysisDossier(anonymized)
      notifySuccess('analysis')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download result analysis report')
    } finally {
      setGenerating(null)
    }
  }

  const handleDownloadHodBrief = async () => {
    setGenerating('hod_brief')
    setErrorMsg(null)
    try {
      const brief = await getHodBrief()
      const content = [
        '='.repeat(72),
        brief.title.toUpperCase(),
        '='.repeat(72),
        `Generated: ${brief.generated_at}`,
        `Status: ${brief.verified ? 'VERIFIED AGAINST MARKSHEET' : 'UNVERIFIED'}`,
        '',
        brief.narrative,
        '',
        '='.repeat(72),
        'VERIFIED FACTS FROM MARKSHEET:',
        '='.repeat(72),
        JSON.stringify(brief.facts_used, null, 2),
      ].join('\n')

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      saveBlobAsFile(blob, 'EduQuery_HOD_Executive_Brief.txt')
      notifySuccess('hod_brief')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate HOD executive brief')
    } finally {
      setGenerating(null)
    }
  }

  const triggerPrintSlips = () => {
    document.body.classList.add('printing-result-slips')
    const cleanup = () => {
      document.body.classList.remove('printing-result-slips')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    setTimeout(cleanup, 2500)
  }

  const handlePrintDivisionSlips = () => {
    triggerPrintSlips()
  }

  const handleDownloadSlipsPdf = async () => {
    setGenerating('slips_pdf')
    setErrorMsg(null)
    try {
      await downloadStudentSlipsPdf('', anonymized)
      notifySuccess('slips_pdf')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download student result slips PDF')
    } finally {
      setGenerating(null)
    }
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
            Institutional Reports
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Download official merit lists, backlogs, result slips, and department summaries.
          </p>
        </div>

        {/* Anonymization Toggle */}
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

      {/* Error Notification */}
      {errorMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            color: 'var(--status-danger-text)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

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
            <strong style={{ color: 'var(--text)' }}>Anonymization Filter Active:</strong> Student names
            are masked across exported spreadsheets, notices, and printed slips. Records are identified
            solely by seat and roll numbers.
          </div>
        </div>
      )}

      {/* Reports Grid (6 Verified Official Documents) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* 1. Result Analysis */}
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
                Complete performance overview
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Detailed breakdown of cohort pass rates, division comparisons, course failure rankings, and reconciliation check status.
          </p>
          <Button
            size="sm"
            variant="primary"
            loading={generating === 'analysis'}
            onClick={handleDownloadAnalysis}
            icon={downloadSuccess === 'analysis' ? <Check size={14} /> : <Download size={14} />}
          >
            {downloadSuccess === 'analysis' ? 'Downloaded' : 'Download Dossier (PDF)'}
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
                Ranked by CGPA and SGPI with tie-break rules
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Complete student ranking ordered by performance, with division rank details and distinction markers.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'merit_list'}
            onClick={handleDownloadMeritList}
            icon={downloadSuccess === 'merit_list' ? <Check size={14} /> : <Download size={14} />}
          >
            {downloadSuccess === 'merit_list' ? 'Downloaded' : 'Export Merit List (Excel)'}
          </Button>
        </GlassCard>

        {/* 3. Failed & Absent Lists */}
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
            Consolidated failed students and absent candidates with exact subject backlog codes and institutional contact information.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'backlogs'}
            onClick={handleDownloadBacklogs}
            icon={downloadSuccess === 'backlogs' ? <Check size={14} /> : <Download size={14} />}
          >
            {downloadSuccess === 'backlogs' ? 'Downloaded' : 'Export Backlog Roster'}
          </Button>
        </GlassCard>

        {/* 4. Result Slips (Printable) */}
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="secondary"
              loading={slipsLoading}
              onClick={handlePrintDivisionSlips}
              icon={<Printer size={14} />}
            >
              Print Division Slips
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={generating === 'slips_pdf'}
              onClick={handleDownloadSlipsPdf}
              icon={downloadSuccess === 'slips_pdf' ? <Check size={14} /> : <Download size={14} />}
            >
              {downloadSuccess === 'slips_pdf' ? 'Downloaded' : 'Download Slips (PDF)'}
            </Button>
          </div>
        </GlassCard>

        {/* 5. Department Head Brief */}
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
                Department Head Brief
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Concise summary for department leadership
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Summary covering cohort pass rates, division comparisons, key subject failure counts, and next steps.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'hod_brief'}
            onClick={handleDownloadHodBrief}
            icon={downloadSuccess === 'hod_brief' ? <Check size={14} /> : <Download size={14} />}
          >
            {downloadSuccess === 'hod_brief' ? 'Downloaded' : 'Export Department Brief'}
          </Button>
        </GlassCard>

        {/* 6. Student Notices Mail-Merge */}
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
                Student Notices Mail-Merge
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Formatted spreadsheet for email notices
              </div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0', lineHeight: 1.5 }}>
            Spreadsheet with student IDs, email addresses, course backlogs, and notice message fields for mail-merge.
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={generating === 'mail_merge'}
            onClick={handleDownloadMailMerge}
            icon={downloadSuccess === 'mail_merge' ? <Check size={14} /> : <Download size={14} />}
          >
            {downloadSuccess === 'mail_merge' ? 'Downloaded' : 'Export Mail-Merge CSV'}
          </Button>
        </GlassCard>
      </div>

      {/* Printable Result Slips Portal (Multi-Page Print Tree) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="print-slips-portal" aria-hidden="true">
            {loadedSlips.map((slip) => (
              <div key={slip.student_id} className="single-student-slip">
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase' }}>
                    University Examination Result Slip
                  </h2>
                  <div style={{ fontSize: '12px', color: '#444' }}>
                    Academic Marksheet Statement &bull; Examination Cell
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
                  <div>
                    <div><strong>Student Name:</strong> {slip.name}</div>
                    <div><strong>Student ID:</strong> {slip.student_id}</div>
                    <div><strong>Division:</strong> {slip.division} &bull; <strong>Level:</strong> {slip.level}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>Seat Number:</strong> {slip.seat_no || '—'}</div>
                    <div><strong>Roll Number:</strong> {slip.roll_no || '—'}</div>
                    <div><strong>Overall Outcome:</strong> <span style={{ fontWeight: 700 }}>{slip.overall_result}</span></div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f2f2f2', borderBottom: '1.5px solid #000' }}>
                      <th style={{ border: '1px solid #ccc', padding: '6px' }}>Code</th>
                      <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'left' }}>Course Title</th>
                      <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Credits</th>
                      <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Marks</th>
                      <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Grade</th>
                      <th style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slip.subjects.map((s) => (
                      <tr key={s.course_code}>
                        <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {s.course_code}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '5px' }}>{s.course_name}</td>
                        <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>{s.credits ?? '—'}</td>
                        <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 600 }}>
                          {s.total_marks !== null ? s.total_marks : (s.is_absent ? 'AB' : '—')}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 700 }}>
                          {s.letter_grade || '—'}
                        </td>
                        <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 700 }}>
                          {s.status.toUpperCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', paddingTop: '10px', fontSize: '12px', marginBottom: '40px' }}>
                  <div>
                    <strong>Total Marks:</strong> {slip.total_marks ?? '—'} &bull; <strong>Total Credits:</strong> {slip.total_credits ?? '—'}
                  </div>
                  <div>
                    <strong>SGPI:</strong> {slip.sgpi !== null ? slip.sgpi.toFixed(2) : '—'} &bull; <strong>CGPA:</strong> {slip.cgpa !== null ? slip.cgpa.toFixed(2) : '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', fontSize: '11px' }}>
                  <div style={{ borderTop: '1px solid #000', width: '180px', textAlign: 'center', paddingTop: '4px' }}>
                    Controller of Examinations
                  </div>
                  <div style={{ borderTop: '1px solid #000', width: '180px', textAlign: 'center', paddingTop: '4px' }}>
                    Head of Department
                  </div>
                  <div style={{ borderTop: '1px solid #000', width: '180px', textAlign: 'center', paddingTop: '4px' }}>
                    Principal / Dean
                  </div>
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

export default ReportsPage
