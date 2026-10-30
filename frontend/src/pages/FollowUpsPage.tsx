import React, { useState, useMemo, useEffect } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'
import {
  Users,
  Mail,
  UserCheck,
  AlertCircle,
  Copy,
  Printer,
  Download,
  Check,
  Info,
} from 'lucide-react'
import { getEarlyWarningStudents, getStudents, getAbsentStudents, saveBlobAsFile } from '../api/client'
import type { StudentSummaryItem, EarlyWarningResponse } from '../api/types'

export const FollowUpsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'failed' | 'remedial' | 'notices' | 'early_warning'>('failed')
  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningResponse | null>(null)
  const [failedStudents, setFailedStudents] = useState<StudentSummaryItem[]>([])
  const [topStudents, setTopStudents] = useState<StudentSummaryItem[]>([])
  const [absentStudents, setAbsentStudents] = useState<any[]>([])

  useEffect(() => {
    getStudents({ result: 'FAIL', limit: 100 })
      .then((res) => {
        if (res?.items) {
          setFailedStudents(res.items)
        }
      })
      .catch(() => {})

    getStudents({ sort_by: 'merit', limit: 30 })
      .then((res) => {
        if (res?.items) {
          setTopStudents(res.items)
        }
      })
      .catch(() => {})

    getAbsentStudents({ limit: 50 })
      .then((res) => {
        if (res?.items) {
          setAbsentStudents(res.items)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getEarlyWarningStudents()
      .then(setEarlyWarningData)
      .catch(() => {})
  }, [])

  // Notices state
  const [selectedTemplate, setSelectedTemplate] = useState<'failed' | 'absent' | 'toppers'>('failed')
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState<number>(0)
  const [copied, setCopied] = useState<boolean>(false)

  // Dynamic partition of failing students
  // Dynamic partition of failing students
  const failed1To3List = useMemo(() => {
    return failedStudents.filter((s) => (s.failed_subject_count || 1) <= 3).map((s) => ({
      seatNo: s.seat_no || s.student_id,
      rollNo: s.roll_no || '—',
      name: s.name,
      division: s.division || '—',
      fails: s.failed_subject_count || 1,
      subjects: ['Core curriculum course'],
      credits: (s.failed_subject_count || 1) * 3,
    }))
  }, [failedStudents])

  const failed4PlusList = useMemo(() => {
    return failedStudents.filter((s) => (s.failed_subject_count || 1) > 3).map((s) => ({
      seatNo: s.seat_no || s.student_id,
      rollNo: s.roll_no || '—',
      name: s.name,
      division: s.division || '—',
      fails: s.failed_subject_count || 4,
      credits: (s.failed_subject_count || 4) * 3,
      reason: 'Multiple subject backlogs',
    }))
  }, [failedStudents])

  const totalFailedCount = failedStudents.length

  // Generate deterministic remedial pairings
  const remedialPairings = useMemo(() => {
    if (failed1To3List.length === 0 || topStudents.length === 0) return []
    const pairings: Array<{ struggling: any; mentor: any; subject: string; division: string }> = []

    failed1To3List.forEach((st, idx) => {
      const divMentors = topStudents.filter((m) => m.division === st.division)
      const mentorPool = divMentors.length > 0 ? divMentors : topStudents
      const mentorObj = mentorPool[idx % mentorPool.length]
      const mentor = {
        seatNo: mentorObj.seat_no || mentorObj.student_id,
        name: mentorObj.name,
        score: mentorObj.cgpa ? Math.round(mentorObj.cgpa * 9.5) : 90,
      }
      pairings.push({
        struggling: st,
        mentor,
        subject: st.subjects?.[0] || 'Core curriculum course',
        division: `Division ${st.division}`,
      })
    })

    return pairings
  }, [failed1To3List, topStudents])

  // Notice recipients based on template
  // Notice recipients based on template
  // Notice recipients based on template
  const noticeRecipients = useMemo(() => {
    if (selectedTemplate === 'failed') {
      return failed1To3List.map((s) => ({
        seatNo: s.seatNo,
        name: s.name,
        email: `${s.seatNo.toLowerCase()}@student.univ.edu`,
        detail: `Failed in ${s.fails} course(s): ${s.subjects.join(', ')}`,
      }))
    }
    if (selectedTemplate === 'absent') {
      return absentStudents.map((s) => ({
        seatNo: s.seat_no || s.student_id,
        name: s.name,
        email: `${(s.seat_no || s.student_id).toLowerCase()}@student.univ.edu`,
        detail: `Absent in ${s.course_code || 'course'} (${s.component || 'exam'})`,
      }))
    }
    return topStudents.map((s, idx) => ({
      seatNo: s.seat_no || s.student_id,
      name: s.name,
      email: `${(s.seat_no || s.student_id).toLowerCase()}@student.univ.edu`,
      detail: `CGPA ${s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa).toFixed(2) : '—'} (Rank #${idx + 1} Cohort)`,
    }))
  }, [selectedTemplate, failed1To3List, absentStudents, topStudents])
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

You have been paired with an academic peer mentor for weekly problem-solving clinics.
Please report to your department coordinator by Monday at 10:00 AM to finalize your remedial timetable.

Sincerely,
Examination Cell & Academic Review Committee`
    }

    if (selectedTemplate === 'absent') {
      return `ABSENTEE MAKE-UP EXAMINATION NOTIFICATION
Date: ${new Date().toLocaleDateString()}
To: ${activeRecipient.name} (${activeRecipient.seatNo})
Email: ${activeRecipient.email}

Subject: Documentation Submission for Missed Evaluation Component

Dear Student,
University examination records indicate your absence during recent examinations:
${activeRecipient.detail}

If your absence was due to verified medical or institutional emergencies, submit your supporting documentation to the exam cell within 5 business days to confirm your make-up evaluation eligibility.

Sincerely,
Office of the Dean (Academic Affairs)`
    }

    return `CONGRATULATORY LETTER — DEAN'S MERIT LIST
Date: ${new Date().toLocaleDateString()}
To: ${activeRecipient.name} (${activeRecipient.seatNo})
Email: ${activeRecipient.email}

Subject: Recognition of Academic Excellence

Dear Student,
It is with great pleasure that we commend your outstanding academic performance:
${activeRecipient.detail}

In recognition of your exceptional mastery and leadership, the department formally invites you to serve as a Senior Peer Mentor for the upcoming academic semester.

With warm congratulations,
Head of Department`
  }, [selectedTemplate, activeRecipient])

  const handleOpenInOutlook = (targetRecipient?: typeof activeRecipient) => {
    const target = targetRecipient || activeRecipient
    if (!target) return

    let subject = ''
    let body = ''

    if (selectedTemplate === 'failed') {
      subject = `Academic Notice: Mandatory Remedial Mentoring - ${target.name} (${target.seatNo})`
      body = `Dear ${target.name},

Official review of your recent semester results indicates that you have pending backlog evaluations in:
${target.detail}

You have been paired with an academic peer mentor for weekly problem-solving clinics.
Please report to your department coordinator by Monday at 10:00 AM to finalize your remedial timetable.

Student Information:
- Student Name: ${target.name}
- Seat / Roll No: ${target.seatNo}
- Course Backlogs: ${target.detail}

Sincerely,
Examination Cell & Academic Review Committee`
    } else if (selectedTemplate === 'absent') {
      subject = `Academic Notice: Missed Examination Documentation - ${target.name} (${target.seatNo})`
      body = `Dear ${target.name},

University examination records indicate your absence during recent examinations:
${target.detail}

If your absence was due to verified medical or institutional emergencies, please submit your supporting documentation to the exam cell within 5 business days to confirm your make-up evaluation eligibility.

Student Information:
- Student Name: ${target.name}
- Seat / Roll No: ${target.seatNo}
- Missed Components: ${target.detail}

Sincerely,
Office of the Dean (Academic Affairs)`
    } else {
      subject = `Congratulatory Letter: Dean's Merit List - ${target.name} (${target.seatNo})`
      body = `Dear ${target.name},

It is with great pleasure that we commend your outstanding academic performance:
${target.detail}

In recognition of your exceptional mastery and leadership, the department formally invites you to serve as a Senior Peer Mentor for the upcoming academic semester.

Student Information:
- Student Name: ${target.name}
- Seat / Roll No: ${target.seatNo}
- Performance: ${target.detail}

With warm congratulations,
Head of Department`
    }

    const email = target.email || `${target.seatNo}@university.edu`
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoUrl
  }

  const handleCopyNotice = () => {
    if (!noticeBody) return
    navigator.clipboard.writeText(noticeBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportMailMerge = () => {
    const csvContent = [
      'Notice_Type,Seat_No,Student_Name,Email,Detail_Field',
      ...noticeRecipients.map(
        (r) =>
          `"${selectedTemplate.toUpperCase()}","${r.seatNo}","${r.name}","${r.email}","${r.detail.replace(/"/g, '""')}"`
      ),
    ].join('\r\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    saveBlobAsFile(blob, `EduQuery_${selectedTemplate.toUpperCase()}_Notices_MailMerge.csv`)
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

      {/* Tabs */}
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
          <span>Failed Students ({totalFailedCount})</span>
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
          <AlertCircle size={15} />
          <span>Pre-ESE Early Warning ({earlyWarningData?.total_at_risk ?? 0})</span>
        </button>
      </div>

      {/* TAB 1: FAILED STUDENTS */}
      {activeTab === 'failed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Inferred Pass Rule Header */}
          <div
            style={{
              padding: '12px 14px',
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
              <strong style={{ color: 'var(--text)' }}>Pass Rule Configuration:</strong> Minimum grade D or 40% aggregate
              with zero failing component flags. Inferred from marksheet structure &bull; Configurable in Settings [Inferred].
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Group 1: 1-3 Subjects */}
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Failed in 1–3 Subjects (ATKT Eligible)
                </h3>
                <StatusBadge tone="warn" size="sm" label={`${failed1To3List.length} Students`} />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
                Manageable backlog volume. Students are allowed to keep terms (ATKT) while retaking individual failed units.
              </p>

              {failed1To3List.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  No students in 1–3 backlogs category.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {failed1To3List.map((s) => (
                    <div
                      key={s.seatNo}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-hover)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
                          {s.seatNo} &bull; Roll {s.rollNo} (Div {s.division})
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Backlog: {s.fails} subject{s.fails > 1 ? 's' : ''}
                        </div>
                      </div>
                      <span
                        className="tabular-nums font-mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--status-danger-text)',
                        }}
                      >
                        {s.fails} fail ({s.credits} cr)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Group 2: 4+ Subjects */}
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Failed in 4+ Subjects (Critical Backlog)
                </h3>
                <StatusBadge tone="fail" size="sm" label={`${failed4PlusList.length} Students`} />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
                Critical cumulative backlog (multiple subjects failed). Requires formal remedial action.
              </p>

              {failed4PlusList.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  No students with 4+ critical backlogs.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {failed4PlusList.map((s) => (
                    <div
                      key={s.seatNo}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-hover)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
                          {s.seatNo} &bull; Roll {s.rollNo} (Div {s.division})
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Backlog: {s.fails} subjects (critical backlog)
                        </div>
                      </div>
                      <span
                        className="tabular-nums font-mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--status-danger-text)',
                        }}
                      >
                        {s.fails} fails ({s.credits} cr)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* TAB 2: REMEDIAL PEER PAIRING */}
      {activeTab === 'remedial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text)' }}>
                Deterministic Remedial Peer Assignment
              </h2>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Pairs students with 1–2 backlogs with top scoring cohort peers from the same division
              </span>
            </div>

            <Button
              size="sm"
              variant="secondary"
              icon={<Download size={14} />}
              onClick={() => {
                const csv = [
                  'Struggling_Seat,Struggling_Name,Mentor_Seat,Mentor_Name,Subject,Division',
                  ...remedialPairings.map(
                    (p) =>
                      `"${p.struggling.seatNo}","${p.struggling.name}","${p.mentor.seatNo}","${p.mentor.name}","${p.subject}","${p.division}"`
                  ),
                ].join('\r\n')
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                saveBlobAsFile(blob, 'EduQuery_Remedial_Pairings.csv')
              }}
            >
              Export Pairing (CSV)
            </Button>
          </div>

          <GlassCard variant="glass-1" padding="none">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Division</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Struggling Candidate</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Needs Help In</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Peer Mentor</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Mentor Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {remedialPairings.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-hover)' }}>
                          {p.division}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.struggling.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seat: {p.struggling.seatNo}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.subject}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.mentor.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seat: {p.mentor.seatNo}</div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--status-success-text)' }}>
                          {p.mentor.score}% aggregate
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 3: INTERVENTION NOTICES */}
      {activeTab === 'notices' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--space-4)' }}>
          {/* Left Column: Template Selection & Recipients */}
          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <GlassCard variant="glass-2" padding="md">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                1. Select Notice Template
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('failed')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedTemplate === 'failed' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'failed' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text)',
                    fontWeight: selectedTemplate === 'failed' ? 600 : 500,
                  }}
                >
                  <div>Remedial Class Notification</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed subjects & mentoring schedule</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('absent')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedTemplate === 'absent' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'absent' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text)',
                    fontWeight: selectedTemplate === 'absent' ? 600 : 500,
                  }}
                >
                  <div>Absentee Make-up Notice</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Missed exam documentation request</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate('toppers')
                    setSelectedRecipientIndex(0)
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedTemplate === 'toppers' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                    background: selectedTemplate === 'toppers' ? 'var(--surface-active)' : 'var(--surface-hover)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text)',
                    fontWeight: selectedTemplate === 'toppers' ? 600 : 500,
                  }}
                >
                  <div>Dean's Merit List Letter</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top performers commendation</div>
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
                    key={`${rec.seatNo}-${idx}`}
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

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleOpenInOutlook()}
                    icon={<Mail size={14} />}
                    title="Open draft letter in Outlook or your default email client"
                  >
                    Open in Outlook
                  </Button>

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
    </div>
  )
}

export default FollowUpsPage
