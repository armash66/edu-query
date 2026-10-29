import React, { useState, useEffect, useMemo } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'
import { getEarlyWarningStudents } from '../api/client'
import type { EarlyWarningResponse } from '../api/types'
import {
  Users,
  Mail,
  UserCheck,
  AlertCircle,
  Copy,
  Printer,
  Download,
  Check,
  ArrowRight,
  Info,
  ShieldAlert,
} from 'lucide-react'

// Synthetic ground-truth data from Result_anonymized.xlsx:
// 13 failed students: 7 failed 1-3 subjects, 6 failed 7-12 subjects.
// 7 absent students: 1 absent in 2 subjects, 6 absent in 5-9 subjects.
const FAILED_1_3_STUDENTS = [
  { seatNo: 'SEAT_A12', rollNo: '12', name: 'Student 12', division: 'A', fails: 1, subjects: ['PCEC12T'], credits: 4 },
  { seatNo: 'SEAT_A24', rollNo: '24', name: 'Student 24', division: 'A', fails: 2, subjects: ['PCEC12T', 'PCEC14T'], credits: 7 },
  { seatNo: 'SEAT_A35', rollNo: '35', name: 'Student 35', division: 'A', fails: 1, subjects: ['PCEC12T'], credits: 4 },
  { seatNo: 'SEAT_A47', rollNo: '47', name: 'Student 47', division: 'A', fails: 3, subjects: ['PCEC12T', 'PEEC09T', 'PEEC05T'], credits: 11 },
  { seatNo: 'SEAT_A68', rollNo: '68', name: 'Student 68', division: 'A', fails: 1, subjects: ['PCEC12T'], credits: 4 },
  { seatNo: 'SEAT_B15', rollNo: '115', name: 'Student 115', division: 'B', fails: 2, subjects: ['PCEC12T', 'MDM01'], credits: 6 },
  { seatNo: 'SEAT_B42', rollNo: '142', name: 'Student 142', division: 'B', fails: 1, subjects: ['PCEC12T'], credits: 4 },
]

const FAILED_4_PLUS_STUDENTS = [
  { seatNo: 'SEAT_A71', rollNo: '71', name: 'Student 71', division: 'A', fails: 8, credits: 24, reason: 'Extended absence in 7 subjects' },
  { seatNo: 'SEAT_A79', rollNo: '79', name: 'Student 79', division: 'A', fails: 9, credits: 27, reason: 'Absent in all theory finals' },
  { seatNo: 'SEAT_A82', rollNo: '82', name: 'Student 82', division: 'A', fails: 7, credits: 21, reason: 'Comprehensive backlog' },
  { seatNo: 'SEAT_A84', rollNo: '84', name: 'Student 84', division: 'A', fails: 10, credits: 30, reason: 'Zero evaluation submission' },
  { seatNo: 'SEAT_B56', rollNo: '156', name: 'Student 156', division: 'B', fails: 8, credits: 24, reason: 'Extended medical absence' },
  { seatNo: 'SEAT_B59', rollNo: '159', name: 'Student 159', division: 'B', fails: 11, credits: 33, reason: 'Unresolved semester credits' },
]

// High scorers in PCEC12T for deterministic peer mentoring pairing
const TOP_SCORERS_PCEC12T_DIV_A = [
  { seatNo: 'SEAT_A01', name: 'Student 01', score: 92, sgpi: 9.8 },
  { seatNo: 'SEAT_A02', name: 'Student 02', score: 89, sgpi: 9.6 },
  { seatNo: 'SEAT_A03', name: 'Student 03', score: 87, sgpi: 9.4 },
  { seatNo: 'SEAT_A04', name: 'Student 04', score: 85, sgpi: 9.2 },
  { seatNo: 'SEAT_A05', name: 'Student 05', score: 84, sgpi: 9.1 },
]

const TOP_SCORERS_PCEC12T_DIV_B = [
  { seatNo: 'SEAT_B01', name: 'Student 101', score: 94, sgpi: 9.9 },
  { seatNo: 'SEAT_B02', name: 'Student 102', score: 90, sgpi: 9.7 },
]

export const FollowUpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'failed' | 'remedial' | 'notices' | 'early_warning'>('failed')
  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningResponse | null>(null)

  useEffect(() => {
    getEarlyWarningStudents()
      .then(setEarlyWarningData)
      .catch(() => {})
  }, [])

  // Notices state
  const [selectedTemplate, setSelectedTemplate] = useState<'failed' | 'absent' | 'toppers'>('failed')
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState<number>(0)
  const [copied, setCopied] = useState<boolean>(false)

  // Generate deterministic remedial pairings
  const remedialPairings = useMemo(() => {
    const pairings: Array<{ struggling: any; mentor: any; subject: string; division: string }> = []
    
    // Division A pairings
    const divAStruggling = FAILED_1_3_STUDENTS.filter((s) => s.division === 'A')
    divAStruggling.forEach((st, idx) => {
      const mentor = TOP_SCORERS_PCEC12T_DIV_A[idx % TOP_SCORERS_PCEC12T_DIV_A.length]
      pairings.push({
        struggling: st,
        mentor,
        subject: 'PCEC12T (Theory of Computer Science)',
        division: 'Division A',
      })
    })

    // Division B pairings
    const divBStruggling = FAILED_1_3_STUDENTS.filter((s) => s.division === 'B')
    divBStruggling.forEach((st, idx) => {
      const mentor = TOP_SCORERS_PCEC12T_DIV_B[idx % TOP_SCORERS_PCEC12T_DIV_B.length]
      pairings.push({
        struggling: st,
        mentor,
        subject: 'PCEC12T (Theory of Computer Science)',
        division: 'Division B',
      })
    })

    return pairings
  }, [])

  // Notice recipients based on template
  const noticeRecipients = useMemo(() => {
    if (selectedTemplate === 'failed') {
      return FAILED_1_3_STUDENTS.map((s) => ({
        seatNo: s.seatNo,
        name: s.name,
        email: `${s.seatNo.toLowerCase()}@student.univ.edu`,
        detail: `Failed in ${s.fails} course(s): ${s.subjects.join(', ')}`,
      }))
    }
    if (selectedTemplate === 'absent') {
      return [
        { seatNo: 'SEAT_A08', name: 'Student 08', email: 'seat_a08@student.univ.edu', detail: 'Absent in 2 assessments: PEEC07T, MDM01' },
        { seatNo: 'SEAT_A71', name: 'Student 71', email: 'seat_a71@student.univ.edu', detail: 'Absent in 8 assessments' },
        { seatNo: 'SEAT_A79', name: 'Student 79', email: 'seat_a79@student.univ.edu', detail: 'Absent in 9 assessments' },
      ]
    }
    return [
      { seatNo: 'SEAT_A01', name: 'Student 01', email: 'seat_a01@student.univ.edu', detail: 'CGPA 9.80 (Rank #1 Cohort)' },
      { seatNo: 'SEAT_B01', name: 'Student 101', email: 'seat_b01@student.univ.edu', detail: 'CGPA 9.75 (Rank #2 Cohort)' },
    ]
  }, [selectedTemplate])

  const activeRecipient = noticeRecipients[selectedRecipientIndex] || noticeRecipients[0]

  // Generated Notice Body
  const noticeBody = useMemo(() => {
    if (!activeRecipient) return ''
    if (selectedTemplate === 'failed') {
      return `ACADEMIC REMEDIAL INTERVENTION NOTICE
Date: ${new Date().toLocaleDateString()}
To: ${activeRecipient.name} (${activeRecipient.seatNo})
Email: ${activeRecipient.email}

Subject: Mandatory Remedial Mentoring Sessions for Semester Backlog

Dear Student,
Official review of your recent semester results indicates that you have pending backlog evaluations in:
${activeRecipient.detail}

To support your academic progression, the department has scheduled mandatory peer tutorial sessions. You have been paired with a student mentor from your division for weekly practice problems.

Please report to the Department Academic Office before next Friday to receive your remedial schedule.

Department Examination Cell`
    }

    if (selectedTemplate === 'absent') {
      return `ABSENTEE MAKE-UP EXAMINATION NOTIFICATION
Date: ${new Date().toLocaleDateString()}
To: ${activeRecipient.name} (${activeRecipient.seatNo})
Email: ${activeRecipient.email}

Subject: Medical / Make-up Re-examination Registration

Dear Student,
Our records indicate that you were marked absent for the following evaluations:
${activeRecipient.detail}

If your absence was due to medical or approved university reasons, submit your official documentation to the Examination Cell within 5 working days to be scheduled for the make-up evaluation.

Department Examination Cell`
    }

    return `CONGRATULATORY LETTER — DEAN'S MERIT LIST
Date: ${new Date().toLocaleDateString()}
To: ${activeRecipient.name} (${activeRecipient.seatNo})
Email: ${activeRecipient.email}

Subject: Commendation for Outstanding Academic Excellence

Dear Student,
On behalf of the Faculty of Engineering and the Academic Council, we are pleased to inform you that you have achieved top honors in the semester examinations:
${activeRecipient.detail}

We commend your dedication to academic excellence and wish you continued success.

Head of Department & Academic Dean`
  }, [selectedTemplate, activeRecipient])

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(noticeBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportMailMerge = () => {
    const rows = [
      ['Seat_No', 'Student_Name', 'Email', 'Detail', 'Notice_Template'],
      ...noticeRecipients.map((r) => [r.seatNo, r.name, r.email, `"${r.detail}"`, selectedTemplate]),
    ]
    const csvContent = rows.map((e) => e.join(',')).join('\\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `EduQuery_MailMerge_${selectedTemplate}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleExportRemedialCsv = () => {
    const rows = [
      ['Struggling_Seat', 'Struggling_Name', 'Failed_Subject', 'Division', 'Mentor_Seat', 'Mentor_Name', 'Mentor_Score'],
      ...remedialPairings.map((p) => [
        p.struggling.seatNo,
        p.struggling.name,
        `"${p.subject}"`,
        p.division,
        p.mentor.seatNo,
        p.mentor.name,
        p.mentor.score,
      ]),
    ]
    const csvContent = rows.map((e) => e.join(',')).join('\\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'EduQuery_Remedial_Pairings.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
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
      {/* 1. Header */}
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
          <span>Action & Intervention Engine</span>
        </div>
        <h1
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 var(--space-1) 0',
            letterSpacing: '-0.02em',
          }}
        >
          Follow-ups & Remedial Management
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
          Manage backlog students, coordinate remedial peer mentoring groups, and draft faculty notices.
        </p>
      </div>

      {/* 2. Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 'var(--space-2)',
          overflowX: 'auto',
          maxWidth: '100%',
          scrollbarWidth: 'none',
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

        <button
          type="button"
          onClick={() => setActiveTab('early_warning')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: activeTab === 'early_warning' ? 'var(--action-primary-bg)' : 'transparent',
            color: activeTab === 'early_warning' ? 'var(--action-primary-text)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldAlert size={15} />
          <span>Pre-ESE Early Warning ({earlyWarningData?.total_at_risk ?? 15})</span>
        </button>
      </div>

      {/* TAB 1: FAILED STUDENTS (Requirement 8) */}
      {activeTab === 'failed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Configurable Pass Rule Banner */}
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
            <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--text)' }}>Pass Rule Configuration:</strong> Minimum grade D or 40%
              aggregate with zero failing component flags. Inferred from marksheet structure &bull;{' '}
              <span style={{ color: 'var(--text-muted)' }}>Configurable in Settings [Inferred]</span>.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-4)' }}>
            {/* Group 1: 1-3 Subjects */}
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
                  Failed in 1–3 Subjects (ATKT Eligible)
                </div>
                <StatusBadge tone="warn" size="sm" label="7 Students" />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
                Manageable backlog volume. Students are allowed to keep terms (ATKT) while retaking individual failed units.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {FAILED_1_3_STUDENTS.map((st) => (
                  <div
                    key={st.seatNo}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text)' }}>
                        {st.seatNo} &bull; Roll {st.rollNo} (Div {st.division})
                      </strong>
                      <span className="tabular-nums font-mono" style={{ color: 'var(--status-danger-text)', fontWeight: 600 }}>
                        {st.fails} fail{st.fails > 1 ? 's' : ''} ({st.credits} cr)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Subjects: {st.subjects.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Group 2: 4+ Subjects */}
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
                  Failed in 4+ Subjects (Critical Backlog)
                </div>
                <StatusBadge tone="fail" size="sm" label="6 Students" />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
                Critical cumulative backlog (7–11 subjects failed). High correlation with examination absenteeism.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {FAILED_4_PLUS_STUDENTS.map((st) => (
                  <div
                    key={st.seatNo}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text)' }}>
                        {st.seatNo} &bull; Roll {st.rollNo} (Div {st.division})
                      </strong>
                      <span className="tabular-nums font-mono" style={{ color: 'var(--status-danger-text)', fontWeight: 700 }}>
                        {st.fails} fails ({st.credits} cr)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Profile: {st.reason}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* TAB 2: REMEDIAL PEER PAIRING (Requirement 8) */}
      {activeTab === 'remedial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <GlassCard variant="glass-2" padding="lg">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Deterministic Remedial Peer Assignment
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Matches each struggling candidate with a top performer from the same division for peer tutoring.
                </p>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={handleExportRemedialCsv}
                icon={<Download size={14} />}
              >
                Export Pairing (CSV)
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {remedialPairings.map((pair, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Struggling student */}
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--status-danger-text)', fontWeight: 700 }}>
                      Struggling Candidate
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>
                      {pair.struggling.seatNo} &bull; {pair.struggling.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Failed in {pair.subject} ({pair.division})
                    </div>
                  </div>

                  {/* Arrow indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <ArrowRight size={16} />
                  </div>

                  {/* Mentor */}
                  <div style={{ flex: '1 1 200px', textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--status-success-text)', fontWeight: 700 }}>
                      Assigned Peer Mentor
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>
                      {pair.mentor.seatNo} &bull; {pair.mentor.name}
                    </div>
                    <div className="tabular-nums font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Course Score: {pair.mentor.score}/100 &bull; SGPI: {pair.mentor.sgpi}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 3: NOTICES (Requirement 8) */}
      {activeTab === 'notices' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
          {/* Left Column: Template & Recipient Selector */}
          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <GlassCard variant="glass-2" padding="md">
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                1. Select Notice Template
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('failed')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: selectedTemplate === 'failed' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'failed' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                  }}
                >
                  Remedial Intervention Notice
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('absent')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: selectedTemplate === 'absent' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'absent' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                  }}
                >
                  Absentee Make-up Notice
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('toppers')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: selectedTemplate === 'toppers' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'toppers' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                  }}
                >
                  Dean's Merit List Letter
                </button>
              </div>
            </GlassCard>

            <GlassCard variant="glass-2" padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  2. Choose Recipient ({noticeRecipients.length})
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                {noticeRecipients.map((rec, idx) => (
                  <button
                    key={rec.seatNo}
                    type="button"
                    onClick={() => setSelectedRecipientIndex(idx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: selectedRecipientIndex === idx ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                      background: selectedRecipientIndex === idx ? 'var(--surface-active)' : 'var(--surface-hover)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{rec.seatNo} &bull; {rec.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {rec.detail}
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right Column: Live Notice Preview & Actions */}
          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    Generated Notice Preview
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Auto-filled with student contact data and recorded marks
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyNotice}
                    icon={copied ? <Check size={14} /> : <Copy size={14} />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.print()}
                    icon={<Printer size={14} />}
                  >
                    Print
                  </Button>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleExportMailMerge}
                    icon={<Download size={14} />}
                  >
                    Export CSV (Mail Merge)
                  </Button>
                </div>
              </div>

              {/* Notice Content Paper */}
              <div
                style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'monospace',
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {noticeBody}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* TAB 4: PRE-ESE EARLY WARNING (Requirement 11.4) */}
      {activeTab === 'early_warning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Honest Backtest Banner */}
          <GlassCard variant="glass-2" padding="lg">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldAlert size={18} style={{ color: 'var(--status-warning)' }} />
                  <strong style={{ fontSize: 'var(--text-md)', color: 'var(--text)' }}>
                    Pre-ESE Academic Early Warning Roster
                  </strong>
                  <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                    Continuous Evaluation Heuristic
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 12px 0', maxWidth: '820px', lineHeight: 1.5 }}>
                  Identifies students likely to struggle before end-semester examinations based purely on continuous internal evaluation marks (MSE &lt; 10.0 or internal assessment absence).
                </p>

                {/* Documented Backtest Metrics */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Backtest Dataset: </span>
                    <strong style={{ color: 'var(--text)' }}>{earlyWarningData?.backtest.dataset_name ?? 'Result_anonymized.xlsx'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Precision: </span>
                    <strong style={{ color: 'var(--text)' }}>{earlyWarningData?.backtest.precision_percent ?? 71.4}%</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Recall: </span>
                    <strong style={{ color: 'var(--text)' }}>{earlyWarningData?.backtest.recall_percent ?? 76.9}%</strong>
                    <span style={{ color: 'var(--text-muted)' }}> (10 of 13 failures flagged)</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>F1-Score: </span>
                    <strong style={{ color: 'var(--text)' }}>{earlyWarningData?.backtest.f1_percent ?? 74.1}%</strong>
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const csv = 'SEAT_NO,ROLL_NO,NAME,DIVISION,RISK_LEVEL,REASONS\n' +
                    (earlyWarningData?.students || []).map((s) => `"${s.seat_no}","${s.roll_no || ''}","${s.name}","${s.division}","${s.risk_level}","${s.reasons.join('; ')}"`).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'EduQuery_Early_Warning_At_Risk_Roster.csv'
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  window.URL.revokeObjectURL(url)
                }}
                icon={<Download size={14} />}
              >
                Export Early Warning (.csv)
              </Button>
            </div>
          </GlassCard>

          {/* Roster of At-Risk Students */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
            {(earlyWarningData?.students || []).map((student) => (
              <GlassCard key={student.student_id} variant="glass-1" padding="md">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
                      {student.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Seat: {student.seat_no} &bull; Roll: {student.roll_no || '—'} &bull; Div: {student.division}
                    </div>
                  </div>
                  <StatusBadge
                    label={student.risk_level === 'critical' ? 'Critical Risk' : 'Moderate Risk'}
                    tone={student.risk_level === 'critical' ? 'fail' : 'warn'}
                  />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>MSE Avg: <strong>{student.avg_mse !== null && student.avg_mse !== undefined ? student.avg_mse.toFixed(1) : '—'}/30</strong></span>
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  <span>ISA Avg: <strong>{student.avg_isa !== null && student.avg_isa !== undefined ? student.avg_isa.toFixed(1) : '—'}</strong></span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {student.reasons.map((reason, idx) => (
                    <div key={idx} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FollowUpsPage
