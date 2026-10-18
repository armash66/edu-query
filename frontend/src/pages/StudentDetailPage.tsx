import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Check,
  AlertCircle,
  Award,
  Download,
} from 'lucide-react'
import {
  getStudentBreakdown,
  downloadStudentBreakdownCsv,
  saveBlobAsFile,
} from '../api/client'
import {
  ApiError,
  type StudentBreakdownResponse,
  type CandidateSummary,
  type ComponentScoreSchema,
} from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { DisambiguationModal } from '../components/DisambiguationModal'

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

  const handleExport = async () => {
    if (!identifier) return
    setExporting(true)
    try {
      const blob = await downloadStudentBreakdownCsv(identifier)
      saveBlobAsFile(blob, `student_breakdown_${identifier}.csv`)
    } catch {
      alert('Failed to download student breakdown CSV. Please try again.')
    } finally {
      setExporting(false)
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
    return <LoadingState message={`Resolving records and compiling breakdown for "${identifier}"...`} />
  }

  // Handle 404
  if (error && error.status === 404) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/students" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Back to Student Roster
          </Link>
        </div>
        <EmptyState
          icon={<AlertCircle size={44} />}
          title="Student Record Not Found"
          message={`No student was found matching the query "${identifier}". Please verify the Roll No or PRN and try searching again.`}
          action={
            <Link to="/students" className="btn btn-primary btn-sm">
              Search Student Roster
            </Link>
          }
        />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/students" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Back to Student Roster
          </Link>
        </div>
        <ErrorBanner error={error} title="Could not load student breakdown" onRetry={fetchBreakdown} />
      </div>
    )
  }

  if (isDisambiguationOpen && ambiguousCandidates.length > 0) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/students" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Back to Student Roster
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
    if (val.includes('PASS')) return <StatusBadge status="passed" text={outcome || 'PASS'} />
    if (val.includes('FAIL')) return <StatusBadge status="failed" text={outcome || 'FAIL'} />
    return <StatusBadge status="unresolved" text={outcome || 'UNRESOLVED'} />
  }

  return (
    <div>
      {/* Back button and quick actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link
          to="/students"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowLeft size={14} /> Back to Student Roster
        </Link>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          title="Export complete student subject breakdown as CSV"
        >
          <Download size={14} /> {exporting ? 'Exporting...' : 'Export Breakdown (CSV)'}
        </button>
      </div>

      {/* Student Identity Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={26} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    {student.name}
                  </h2>
                  {getOutcomeBadge(student.overall_result)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.4rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {student.roll_no && (
                    <span>
                      Roll No: <strong style={{ color: 'var(--text-main)' }}>{student.roll_no}</strong>
                    </span>
                  )}
                  {student.seat_no && (
                    <span>
                      Seat No: <strong style={{ color: 'var(--text-main)' }}>{student.seat_no}</strong>
                    </span>
                  )}
                  {student.division && (
                    <span>
                      Division: <strong style={{ color: 'var(--text-main)' }}>{student.division}</strong>
                    </span>
                  )}
                  {student.email && (
                    <span>
                      Email: <strong style={{ color: 'var(--text-main)' }}>{student.email}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Overall Academic Metrics */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {student.total_marks != null && (
                <div style={{ padding: '0.5rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Marks</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>{student.total_marks}</div>
                </div>
              )}
              {student.sgpi != null && (
                <div style={{ padding: '0.5rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>SGPI</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>{student.sgpi.toFixed(2)}</div>
                </div>
              )}
              {student.cgpa != null && (
                <div style={{ padding: '0.5rem 0.85rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CGPA</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>{student.cgpa.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subjects Outcome Summary Bar */}
        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#fafbfc', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
          <div>
            Enrolled Subjects: <strong>{data.total_enrolled}</strong>
          </div>
          <div style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={14} style={{ color: '#10b981' }} />
            Passed: <strong>{passed_count}</strong>
          </div>
          <div style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertTriangle size={14} style={{ color: '#ef4444' }} />
            Failed: <strong>{failed_count}</strong>
          </div>
          {unresolved_count > 0 && (
            <div style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <HelpCircle size={14} style={{ color: '#f59e0b' }} />
              Unresolved: <strong>{unresolved_count}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Subject-by-Subject Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Award size={18} style={{ color: 'var(--primary)' }} />
            <span>Curriculum Subject Performance Breakdown</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Components, calculated sums, and printed totals verified by ingestion engine
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Course Code & Title</th>
                <th>Kind / Credits</th>
                <th>Component Scores</th>
                <th>Sum of Components</th>
                <th>Printed Total</th>
                <th>Match</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => {
                const outcome = sub.recorded_result || 'unresolved'
                const statusType = outcome === 'passed' ? 'passed' : outcome === 'failed' ? 'failed' : 'unresolved'

                const componentEntries = Object.entries(sub.components || {})

                return (
                  <tr key={sub.course_code}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{sub.course_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {sub.course_code}
                      </div>
                      {sub.flags && sub.flags.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          {sub.flags.map((flag, idx) => (
                            <span key={idx} className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                      {sub.is_absent && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginTop: '0.2rem' }}>
                          ABSENT
                        </span>
                      )}
                    </td>

                    <td>
                      <div>{sub.kind || '—'}</div>
                      {sub.credits != null && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {sub.credits} Credits
                        </div>
                      )}
                    </td>

                    <td>
                      {componentEntries.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No component marks</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {componentEntries.map(([compName, score]: [string, ComponentScoreSchema]) => {
                            let scoreDisplay = '—'
                            let badgeClass = ''

                            if (score.state === 'marked') {
                              scoreDisplay = score.marks !== null ? String(score.marks) : (score.raw_text || '—')
                            } else if (score.state === 'not_enrolled') {
                              scoreDisplay = 'N/E'
                              badgeClass = 'badge-neutral'
                            } else if (score.state === 'flagged') {
                              scoreDisplay = score.flag || score.raw_text || 'Flagged'
                              badgeClass = 'badge-warning'
                            } else if (score.state === 'uncalculated') {
                              scoreDisplay = 'Uncalc'
                              badgeClass = 'badge-info'
                            } else if (score.state === 'unparsed') {
                              scoreDisplay = score.raw_text || 'Unparsed'
                              badgeClass = 'badge-danger'
                            }

                            return (
                              <div
                                key={compName}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78rem',
                                  padding: '0.15rem 0.35rem',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span style={{ color: '#475569', fontWeight: 500 }}>{compName}:</span>
                                {badgeClass ? (
                                  <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                                    {scoreDisplay}
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{scoreDisplay}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>

                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {sub.computed_marks_sum !== null ? sub.computed_marks_sum : '—'}
                    </td>

                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {sub.total_marks !== null ? sub.total_marks : '—'}
                      {sub.letter_grade && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({sub.letter_grade})
                        </span>
                      )}
                    </td>

                    <td>
                      {sub.total_match === true ? (
                        <span
                          className="badge badge-success"
                          title="Computed sum exactly matches the printed total"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Check size={11} /> Match
                        </span>
                      ) : sub.total_match === false ? (
                        <span
                          className="badge badge-warning"
                          title="Computed component sum differs from printed marksheet total"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <AlertTriangle size={11} /> Mismatch
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge status={statusType} text={outcome.toUpperCase()} />
                      {sub.classification_reason && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {sub.classification_reason}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

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
