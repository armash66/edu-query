import React, { useEffect, useState, useCallback } from 'react'

import { useParams, useNavigate, Link } from 'react-router-dom'

import {

  ArrowLeft,

  Mail,

  User,

  CheckCircle,

  AlertTriangle,

  HelpCircle,

  Check,

  AlertCircle,

  Award,

  Download,

  Printer,

} from 'lucide-react'

import {

  getStudentBreakdown,

  downloadStudentBreakdownCsv,

  downloadStudentBreakdownExcel,
  downloadSingleStudentSlipPdf,

  saveBlobAsFile,

} from '../api/client'

import {

  ApiError,

  type StudentBreakdownResponse,

  type CandidateSummary,

  type ComponentScoreSchema,

} from '../api/types'

import { GlassCard } from '../ui/GlassCard'

import { Button } from '../ui/Button'

import { StatusBadge } from '../ui/StatusBadge'

import { EmptyState } from '../ui/EmptyState'

import { ErrorState } from '../ui/ErrorState'

import { DisambiguationModal } from '../components/DisambiguationModal'

import { Skeleton } from '../ui/Skeleton'

import { toTitleCase } from '../utils/text'



export const StudentDetailPage: React.FC = () => {

  const { identifier } = useParams<{ identifier: string }>()

  const navigate = useNavigate()



  const [data, setData] = useState<StudentBreakdownResponse | null>(null)

  const [loading, setLoading] = useState<boolean>(true)

  const [error, setError] = useState<ApiError | null>(null)



  // 409 Ambiguous Candidates State

  const [ambiguousCandidates, setAmbiguousCandidates] = useState<CandidateSummary[]>([])

  const [ambiguousQuery, setAmbiguousQuery] = useState<string>('')

  const [isDisambiguationOpen, setIsDisambiguationOpen] = useState<boolean>(false)



  const [exporting, setExporting] = useState<boolean>(false)

  const [exportingExcel, setExportingExcel] = useState<boolean>(false)

  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false)



  const handleExport = async () => {

    if (!identifier) return

    setExporting(true)

    try {

      const blob = await downloadStudentBreakdownCsv(identifier)

      saveBlobAsFile(blob, `EduQuery_Student_${identifier}_Breakdown.csv`)

    } catch {

      alert('Failed to download student breakdown CSV. Please try again.')

    } finally {

      setExporting(false)

    }

  }



  const handleEmailStudent = () => {

    const student = data?.student

    if (!student) return

    const recipientEmail = student.email || `${student.roll_no || student.student_id}@university.edu`

    const isPass = (student.overall_result || '').toUpperCase().includes('PASS')

    const failedSubjects = (data?.subjects || [])

      .filter((s) => (s.recorded_result || '').toUpperCase().includes('FAIL') || (s.letter_grade || '').toUpperCase() === 'F')

      .map((s) => `${s.course_name} (${s.course_code})`)



    let subject = ''

    let body = ''



    if (isPass) {

      subject = `Semester Examination Result: ${toTitleCase(student.name)} (${student.seat_no || student.student_id})`

      body = `Dear ${toTitleCase(student.name)},



This is an official communication regarding your semester examination results.



Academic Summary:

- Student Name: ${toTitleCase(student.name)}

- Seat Number: ${student.seat_no || 'N/A'}

- Roll Number: ${student.roll_no || 'N/A'}

- Division: ${student.division || 'N/A'}

- Total Marks: ${student.total_marks ?? 'N/A'}

- SGPI: ${student.sgpi !== null && student.sgpi !== undefined ? Number(student.sgpi).toFixed(2) : 'N/A'}

- CGPA: ${student.cgpa !== null && student.cgpa !== undefined ? Number(student.cgpa).toFixed(2) : 'N/A'}

- Overall Result: ${student.overall_result || 'PASSED'}



Congratulations on your successful completion of the semester examinations.



Sincerely,

Examination Cell & Department Faculty`

    } else {

      subject = `Academic Notice: Examination Result & Backlog Review - ${toTitleCase(student.name)} (${student.seat_no || student.student_id})`

      body = `Dear ${toTitleCase(student.name)},



This is an official communication regarding your semester examination results and academic standing.



Academic Summary:

- Student Name: ${toTitleCase(student.name)}

- Seat Number: ${student.seat_no || 'N/A'}

- Roll Number: ${student.roll_no || 'N/A'}

- Division: ${student.division || 'N/A'}

- Overall Result: ${student.overall_result || 'FAILED'}

- Backlog Subjects:

  ${failedSubjects.length > 0 ? failedSubjects.map((s: string) => `• ${s}`).join('\n  ') : '• Pending evaluation'}



Please contact your academic advisor or examination cell coordinator to discuss remedial sessions and schedule your re-examination applications.



Sincerely,

Examination Cell & Academic Review Committee`

    }



    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    window.location.href = mailtoUrl

  }



  const [exportingPdf, setExportingPdf] = useState<boolean>(false)

  const handleExportPdf = async () => {
    if (!identifier) return
    setExportingPdf(true)
    try {
      await downloadSingleStudentSlipPdf(identifier)
    } catch {
      alert('Failed to download student result slip PDF. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {

    if (!identifier) return

    setExportingExcel(true)

    try {

      const blob = await downloadStudentBreakdownExcel(identifier)

      saveBlobAsFile(blob, `EduQuery_Student_${identifier}_Breakdown.xlsx`)

    } catch {

      alert('Failed to download student breakdown Excel workbook. Please try again.')

    } finally {

      setExportingExcel(false)

    }

  }



  const fetchBreakdown = useCallback(async () => {

    if (!identifier) return

    setLoading(true)

    setError(null)

    setIsDisambiguationOpen(false)



    try {

      const res = await getStudentBreakdown(identifier)

      setData(res)

    } catch (err: unknown) {

      if (err instanceof ApiError) {

        if (err.status === 409 && err.ambiguousCandidates) {

          setAmbiguousCandidates(err.ambiguousCandidates as CandidateSummary[])

          setAmbiguousQuery(err.query || identifier)

          setIsDisambiguationOpen(true)

        } else {

          setError(err)

        }

      } else {

        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve student breakdown'))

      }

    } finally {

      setLoading(false)

    }

  }, [identifier])



  useEffect(() => {

    fetchBreakdown()

  }, [fetchBreakdown])



  const handleSelectCandidate = (candidate: CandidateSummary) => {

    setIsDisambiguationOpen(false)

    navigate(`/students/${encodeURIComponent(candidate.student_id)}`)

  }



  if (loading) {

    return (

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

        <div style={{ marginBottom: 'var(--space-4)' }}>

          <Skeleton height="36px" width="180px" />

        </div>

        <Skeleton height="160px" radius="var(--radius-card)" style={{ marginBottom: 'var(--space-6)' }} />

        <Skeleton height="300px" radius="var(--radius-card)" />

      </div>

    )

  }



  // Handle 404

  if (error && error.status === 404) {

    return (

      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 var(--space-4)' }}>

        <div style={{ marginBottom: 'var(--space-4)' }}>

          <Link

            to="/students"

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: 'var(--space-2)',

              fontSize: 'var(--text-sm)',

              color: 'var(--text-secondary)',

              textDecoration: 'none',

            }}

          >

            <ArrowLeft size={16} /> Back to Student Roster

          </Link>

        </div>

        <EmptyState

          icon={<AlertCircle size={44} />}

          title="Student Record Not Found"

          description={`No student was found matching the query "${identifier}". Please verify the Roll No or PRN and try searching again.`}

          action={

            <Button variant="primary" onClick={() => navigate('/students')}>

              Search Student Roster

            </Button>

          }

        />

      </div>

    )

  }



  if (error) {

    return (

      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 var(--space-4)' }}>

        <div style={{ marginBottom: 'var(--space-4)' }}>

          <Link

            to="/students"

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: 'var(--space-2)',

              fontSize: 'var(--text-sm)',

              color: 'var(--text-secondary)',

              textDecoration: 'none',

            }}

          >

            <ArrowLeft size={16} /> Back to Student Roster

          </Link>

        </div>

        <ErrorState

          title="Could not load student breakdown"

          message={error.message || 'Database error retrieving student records.'}

          onRetry={fetchBreakdown}

        />

      </div>

    )

  }



  if (isDisambiguationOpen && ambiguousCandidates.length > 0) {

    return (

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

        <div style={{ marginBottom: 'var(--space-4)' }}>

          <Link

            to="/students"

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: 'var(--space-2)',

              fontSize: 'var(--text-sm)',

              color: 'var(--text-secondary)',

              textDecoration: 'none',

            }}

          >

            <ArrowLeft size={16} /> Back to Student Roster

          </Link>

        </div>

        <DisambiguationModal

          isOpen={isDisambiguationOpen}

          query={ambiguousQuery}

          candidates={ambiguousCandidates}

          onSelect={handleSelectCandidate}

          onClose={() => {

            setIsDisambiguationOpen(false)

            navigate('/students')

          }}

        />

      </div>

    )

  }



  if (!data) return null



  const { student, subjects, passed_count, failed_count, unresolved_count } = data



  const getOutcomeBadge = (outcome: string | null) => {

    const val = (outcome || '').toUpperCase()

    if (val.includes('PASS')) return <StatusBadge tone="pass" label={outcome || 'PASS'} />

    if (val.includes('FAIL')) return <StatusBadge tone="fail" label={outcome || 'FAIL'} />

    return <StatusBadge tone="warn" label={outcome || 'UNRESOLVED'} />

  }



  return (

    <div

      style={{

        maxWidth: '1200px',

        margin: '0 auto',

        padding: 'var(--space-6) var(--space-4) var(--space-12)',

        display: 'flex',

        flexDirection: 'column',

        gap: 'var(--space-6)',

      }}

    >

      {/* Back button and quick actions */}

      <div

        style={{

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'space-between',

          flexWrap: 'wrap',

          gap: 'var(--space-3)',

        }}

      >

        <Link

          to="/students"

          style={{

            display: 'inline-flex',

            alignItems: 'center',

            gap: 'var(--space-2)',

            fontSize: 'var(--text-sm)',

            fontWeight: 500,

            color: 'var(--text)',

            textDecoration: 'none',

            padding: '6px 12px',

            borderRadius: 'var(--radius-sm)',

            background: 'var(--surface-hover)',

          }}

        >

          <ArrowLeft size={16} />

          <span>Back to Student Roster</span>

        </Link>



        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          <Button

            size="sm"

            variant="secondary"

            onClick={handleEmailStudent}

            icon={<Mail size={14} />}

            title="Open pre-filled letter in Outlook"

          >

            Email Student

          </Button>



          <div style={{ position: 'relative' }}>

            <Button

              size="sm"

              variant="secondary"

              onClick={() => setIsExportMenuOpen((prev) => !prev)}

            icon={<Download size={14} />}

            aria-haspopup="menu"

            aria-expanded={isExportMenuOpen}

          >

            Export

          </Button>

          {isExportMenuOpen && (

            <div

              role="menu"

              className="glass-3"

              style={{

                position: 'absolute',

                top: 'calc(100% + 4px)',

                right: 0,

                zIndex: 50,

                minWidth: '180px',

                padding: '4px',

                borderRadius: 'var(--radius-md)',

                boxShadow: 'var(--shadow-lg)',

                display: 'flex',

                flexDirection: 'column',

                gap: '2px',

              }}

            >

              <button

                role="menuitem"

                type="button"

                onClick={() => {

                  setIsExportMenuOpen(false)

                  window.print()

                }}

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: '8px',

                  padding: '8px 12px',

                  background: 'transparent',

                  border: 'none',

                  color: 'var(--text)',

                  fontSize: 'var(--text-xs)',

                  cursor: 'pointer',

                  borderRadius: 'var(--radius-sm)',

                  textAlign: 'left',

                  width: '100%',

                }}

              >

                <Printer size={14} />

                <span>Print Marksheet</span>

              </button>



              <button
                role="menuitem"
                type="button"
                disabled={exportingPdf}
                onClick={() => {
                  setIsExportMenuOpen(false)
                  handleExportPdf()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Download size={14} />
                <span>Download Result Slip (.pdf)</span>
              </button>

              <button

                role="menuitem"

                type="button"

                disabled={exportingExcel}

                onClick={() => {

                  setIsExportMenuOpen(false)

                  handleExportExcel()

                }}

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: '8px',

                  padding: '8px 12px',

                  background: 'transparent',

                  border: 'none',

                  color: 'var(--text)',

                  fontSize: 'var(--text-xs)',

                  cursor: 'pointer',

                  borderRadius: 'var(--radius-sm)',

                  textAlign: 'left',

                  width: '100%',

                }}

              >

                <Download size={14} />

                <span>Export Excel (.xlsx)</span>

              </button>



              <button

                role="menuitem"

                type="button"

                disabled={exporting}

                onClick={() => {

                  setIsExportMenuOpen(false)

                  handleExport()

                }}

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: '8px',

                  padding: '8px 12px',

                  background: 'transparent',

                  border: 'none',

                  color: 'var(--text)',

                  fontSize: 'var(--text-xs)',

                  cursor: 'pointer',

                  borderRadius: 'var(--radius-sm)',

                  textAlign: 'left',

                  width: '100%',

                }}

              >

                <Download size={14} />

                <span>Export CSV (.csv)</span>

              </button>

            </div>

          )}

          </div>

        </div>

      </div>



      {/* Student Identity Card */}

      <GlassCard variant="glass-2" padding="lg">

        <div

          style={{

            display: 'flex',

            alignItems: 'flex-start',

            justifyContent: 'space-between',

            flexWrap: 'wrap',

            gap: 'var(--space-4)',

          }}

        >

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>

            <div

              style={{

                width: '52px',

                height: '52px',

                borderRadius: 'var(--radius-card)',

                backgroundColor: 'var(--surface-hover)',

                color: 'var(--text)',

                display: 'flex',

                alignItems: 'center',

                justifyContent: 'center',

                border: '1px solid var(--border)',

                flexShrink: 0,

              }}

            >

              <User size={28} />

            </div>



            <div>

              <div

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: 'var(--space-3)',

                  flexWrap: 'wrap',

                }}

              >

                <h1

                  style={{

                    fontSize: 'var(--text-xl)',

                    fontWeight: 700,

                    color: 'var(--text)',

                    margin: 0,

                    display: '-webkit-box',

                    WebkitLineClamp: 2,

                    WebkitBoxOrient: 'vertical',

                    overflow: 'hidden',

                    lineHeight: 1.25,

                  }}

                  title={student.name}

                >

                  {toTitleCase(student.name)}

                </h1>

                {getOutcomeBadge(student.overall_result)}

              </div>



              <div

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  gap: 'var(--space-4)',

                  marginTop: 'var(--space-2)',

                  flexWrap: 'wrap',

                  fontSize: 'var(--text-xs)',

                  color: 'var(--text-secondary)',

                }}

              >

                {student.roll_no && (

                  <span>

                    Roll No: <strong style={{ color: 'var(--text)' }}>{student.roll_no}</strong>

                  </span>

                )}

                {student.seat_no && (

                  <span>

                    Seat No: <strong style={{ color: 'var(--text)' }}>{student.seat_no}</strong>

                  </span>

                )}

                {student.division && (

                  <span>

                    Division: <strong style={{ color: 'var(--text)' }}>{student.division}</strong>

                  </span>

                )}

                {student.email && (

                  <span>

                    Email: <strong style={{ color: 'var(--text)' }}>{student.email}</strong>

                  </span>

                )}

              </div>

            </div>

          </div>



          {/* Overall Academic Metrics (3-column grid) */}

          <div

            style={{

              display: 'grid',

              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',

              gap: 'var(--space-3)',

              width: '100%',

              maxWidth: '380px',

            }}

          >

            {student.total_marks != null && (

              <div

                className="data-surface"

                style={{

                  padding: 'var(--space-2) var(--space-4)',

                  borderRadius: 'var(--radius-sm)',

                  border: '1px solid var(--border)',

                  textAlign: 'center',

                }}

              >

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>

                  Total Marks

                </div>

                <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text)' }}>

                  {student.total_marks}

                </div>

              </div>

            )}

            {student.sgpi != null && (

              <div

                className="data-surface"

                style={{

                  padding: 'var(--space-2) var(--space-4)',

                  borderRadius: 'var(--radius-sm)',

                  border: '1px solid var(--border)',

                  textAlign: 'center',

                }}

              >

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>

                  SGPI

                </div>

                <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text)' }}>

                  {student.sgpi.toFixed(2)}

                </div>

              </div>

            )}

            {student.cgpa != null && (

              <div

                className="data-surface"

                style={{

                  padding: 'var(--space-2) var(--space-4)',

                  borderRadius: 'var(--radius-sm)',

                  border: '1px solid var(--border)',

                  textAlign: 'center',

                }}

              >

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>

                  CGPA

                </div>

                <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text)' }}>

                  {student.cgpa.toFixed(2)}

                </div>

              </div>

            )}

          </div>

        </div>



        {/* Subjects Outcome Summary Bar */}

        <div

          style={{

            padding: 'var(--space-3) var(--space-4)',

            marginTop: 'var(--space-4)',

            borderTop: '1px solid var(--border)',

            display: 'flex',

            alignItems: 'center',

            gap: 'var(--space-3)',

            flexWrap: 'wrap',

            fontSize: 'var(--text-xs)',

          }}

        >

          <div

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: '6px',

              padding: '4px 10px',

              borderRadius: 'var(--radius-sm)',

              background: 'var(--surface-hover)',

              border: '1px solid var(--border)',

              color: 'var(--text-secondary)',

              fontWeight: 500,

            }}

          >

            <span>Enrolled Subjects:</span>

            <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{data.total_enrolled}</strong>

          </div>



          <div

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: '6px',

              padding: '4px 10px',

              borderRadius: 'var(--radius-sm)',

              background: 'rgba(34, 197, 94, 0.1)',

              border: '1px solid rgba(34, 197, 94, 0.25)',

              color: 'var(--status-success-text)',

              fontWeight: 500,

            }}

          >

            <CheckCircle size={13} style={{ flexShrink: 0 }} />

            <span>Passed:</span>

            <strong style={{ fontWeight: 700 }}>{passed_count}</strong>

          </div>



          <div

            style={{

              display: 'inline-flex',

              alignItems: 'center',

              gap: '6px',

              padding: '4px 10px',

              borderRadius: 'var(--radius-sm)',

              background: failed_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-hover)',

              border: failed_count > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border)',

              color: failed_count > 0 ? 'var(--status-danger-text)' : 'var(--text-muted)',

              fontWeight: 500,

            }}

          >

            <AlertTriangle size={13} style={{ flexShrink: 0 }} />

            <span>Failed:</span>

            <strong style={{ fontWeight: 700 }}>{failed_count}</strong>

          </div>



          {unresolved_count > 0 && (

            <div

              style={{

                display: 'inline-flex',

                alignItems: 'center',

                gap: '6px',

                padding: '4px 10px',

                borderRadius: 'var(--radius-sm)',

                background: 'rgba(245, 158, 11, 0.1)',

                border: '1px solid rgba(245, 158, 11, 0.25)',

                color: 'var(--status-warning-text)',

                fontWeight: 500,

              }}

            >

              <HelpCircle size={13} style={{ flexShrink: 0 }} />

              <span>Unresolved:</span>

              <strong style={{ fontWeight: 700 }}>{unresolved_count}</strong>

            </div>

          )}

        </div>

      </GlassCard>



      {/* Subject-by-Subject Breakdown Table */}

      <GlassCard variant="glass-2" padding="none">

        <div

          style={{

            padding: 'var(--space-4) var(--space-6)',

            borderBottom: '1px solid var(--border)',

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'space-between',

          }}

        >

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>

            <Award size={18} />

            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 650, color: 'var(--text)', margin: 0 }}>

              Curriculum Subject Performance Breakdown

            </h2>

          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>

            Components, calculated sums, and printed totals verified by ingestion engine

          </div>

        </div>



        <div style={{ overflowX: 'auto' }}>

          <table

            style={{

              width: '100%',

              borderCollapse: 'collapse',

              textAlign: 'left',

              fontSize: 'var(--text-xs)',

            }}

          >

            <thead>

              <tr style={{ borderBottom: '1px solid var(--border-strong)', background: 'var(--surface-hover)' }}>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Course Code & Title

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Kind / Credits

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Component Scores

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Sum of Components

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Printed Total

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Match

                </th>

                <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>

                  Outcome

                </th>

              </tr>

            </thead>

            <tbody>

              {subjects.map((sub) => {

                const outcome = sub.recorded_result || 'unresolved'

                const statusTone =

                  outcome === 'passed' ? 'pass' : outcome === 'failed' ? 'fail' : 'warn'



                const componentEntries = Object.entries(sub.components || {})



                return (

                  <tr

                    key={sub.course_code}

                    style={{ borderBottom: '1px solid var(--border-hairline)', height: '48px' }}

                  >

                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>

                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{sub.course_name}</div>

                      <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>

                        {sub.course_code}

                      </div>

                      {sub.flags && sub.flags.length > 0 && (

                        <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>

                          {sub.flags.map((flag, idx) => (

                            <span

                              key={idx}

                              style={{

                                fontSize: '10px',

                                fontWeight: 600,

                                padding: '1px 5px',

                                borderRadius: 'var(--radius-xs)',

                                background: 'var(--status-warning-bg)',

                                color: 'var(--status-warning-text)',

                                border: '1px solid var(--status-warning-border)',

                              }}

                            >

                              {flag}

                            </span>

                          ))}

                        </div>

                      )}

                      {sub.is_absent && (

                        <span

                          style={{

                            fontSize: '10px',

                            fontWeight: 700,

                            padding: '1px 5px',

                            borderRadius: 'var(--radius-xs)',

                            background: 'var(--status-danger-bg)',

                            color: 'var(--status-danger-text)',

                            border: '1px solid var(--status-danger-border)',

                            display: 'inline-block',

                            marginTop: '2px',

                          }}

                        >

                          ABSENT

                        </span>

                      )}

                    </td>



                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>

                      <div>{sub.kind || '—'}</div>

                      {sub.credits != null && (

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>

                          {sub.credits} Credits

                        </div>

                      )}

                    </td>



                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>

                      {componentEntries.length === 0 ? (

                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No component marks</span>

                      ) : (

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>

                          {componentEntries.map(([compName, score]: [string, ComponentScoreSchema]) => {

                            let scoreDisplay = '—'



                            if (score.state === 'marked') {

                              scoreDisplay =

                                score.marks !== null ? String(score.marks) : score.raw_text || '—'

                            } else if (score.state === 'not_enrolled') {

                              scoreDisplay = 'N/E'

                            } else if (score.state === 'flagged') {

                              scoreDisplay = score.flag || score.raw_text || 'Flagged'

                            } else if (score.state === 'uncalculated') {

                              scoreDisplay = 'Uncalc'

                            } else if (score.state === 'unparsed') {

                              scoreDisplay = score.raw_text || 'Unparsed'

                            }



                            return (

                              <div

                                key={compName}

                                style={{

                                  display: 'flex',

                                  alignItems: 'center',

                                  justifyContent: 'space-between',

                                  fontSize: '11px',

                                  padding: '2px 6px',

                                  backgroundColor: 'var(--surface-hover)',

                                  borderRadius: 'var(--radius-xs)',

                                  border: '1px solid var(--border)',

                                }}

                              >

                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>

                                  {compName}:

                                </span>

                                <span className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text)' }}>

                                  {scoreDisplay}

                                </span>

                              </div>

                            )

                          })}

                        </div>

                      )}

                    </td>



                    <td className="tabular-nums font-mono" style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>

                      {sub.computed_marks_sum !== null ? sub.computed_marks_sum : '—'}

                    </td>



                    <td className="tabular-nums font-mono" style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>

                      {sub.total_marks !== null ? sub.total_marks : '—'}

                      {sub.letter_grade && (

                        <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>

                          ({sub.letter_grade})

                        </span>

                      )}

                    </td>



                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>

                      {sub.total_match === true ? (

                        <span

                          style={{

                            display: 'inline-flex',

                            alignItems: 'center',

                            gap: '3px',

                            color: 'var(--status-success-text)',

                            background: 'var(--status-success-bg)',

                            border: '1px solid var(--status-success-border)',

                            padding: '2px 6px',

                            borderRadius: 'var(--radius-xs)',

                            fontWeight: 600,

                          }}

                          title="Computed sum exactly matches the printed total"

                        >

                          <Check size={11} /> Match

                        </span>

                      ) : sub.total_match === false ? (

                        <span

                          style={{

                            display: 'inline-flex',

                            alignItems: 'center',

                            gap: '3px',

                            color: 'var(--status-warning-text)',

                            background: 'var(--status-warning-bg)',

                            border: '1px solid var(--status-warning-border)',

                            padding: '2px 6px',

                            borderRadius: 'var(--radius-xs)',

                            fontWeight: 600,

                          }}

                          title="Computed component sum differs from printed marksheet total"

                        >

                          <AlertTriangle size={11} /> Mismatch

                        </span>

                      ) : (

                        <span style={{ color: 'var(--text-muted)' }}>—</span>

                      )}

                    </td>



                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>

                      <StatusBadge tone={statusTone} label={outcome.toUpperCase()} size="sm" />

                    </td>

                  </tr>

                )

              })}

            </tbody>

          </table>

        </div>

      </GlassCard>



      {/* Disambiguation Modal for HTTP 409 Resolution */}

      <DisambiguationModal

        isOpen={isDisambiguationOpen}

        query={ambiguousQuery}

        candidates={ambiguousCandidates}

        onSelect={handleSelectCandidate}

        onClose={() => {

          setIsDisambiguationOpen(false)

          navigate('/students')

        }}

      />

    </div>

  )

}



export default StudentDetailPage

