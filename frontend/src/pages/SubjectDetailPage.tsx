import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  Filter,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  Download,
} from 'lucide-react'
import { getSubjectFailures, getSubjectFailuresExportUrl } from '../api/client'
import {
  ApiError,
  type SubjectFailureResponse,
  type FailingStudentItem,
  type ComponentScoreSchema,
} from '../api/types'
import { Pagination } from '../components/Pagination'
import { LoadingState } from '../components/LoadingState'
import { ErrorBanner } from '../components/ErrorBanner'

export const SubjectDetailPage: React.FC = () => {
  const { courseCode } = useParams<{ courseCode: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const divisionParam = searchParams.get('division') || ''
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  const [data, setData] = useState<SubjectFailureResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const pageSize = 25

  const fetchCourseFailures = useCallback(async () => {
    if (!courseCode) return
    setLoading(true)
    setError(null)

    try {
      const res = await getSubjectFailures(courseCode, {
        division: divisionParam.trim() || undefined,
        limit: pageSize,
        offset: (pageParam - 1) * pageSize,
      })
      setData(res)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve subject failure roster'))
      }
    } finally {
      setLoading(false)
    }
  }, [courseCode, divisionParam, pageParam])

  useEffect(() => {
    fetchCourseFailures()
  }, [fetchCourseFailures])

  const handleDivisionChange = (newDivision: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (newDivision) {
      nextParams.set('division', newDivision)
    } else {
      nextParams.delete('division')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('page', String(newPage))
    setSearchParams(nextParams)
  }

  if (loading && !data) {
    return <LoadingState message={`Retrieving failure roster for course "${courseCode}"...`} />
  }

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Link
          to={`/failures${divisionParam ? `?division=${encodeURIComponent(divisionParam)}` : ''}`}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowLeft size={14} /> Back to Failure Summary
        </Link>
      </div>

      {error && (
        <ErrorBanner
          error={error}
          title="Could not load failure roster"
          onRetry={fetchCourseFailures}
        />
      )}

      {data && (
        <>
          {/* Course Details & Stats Header Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                      {data.course_code}
                    </span>
                    {data.kind && (
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {data.kind}
                      </span>
                    )}
                    {data.credits != null && (
                      <span className="badge badge-neutral">{data.credits} Credits</span>
                    )}
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
                    {data.course_name}
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Verified failing students confirmed by course-specific passing thresholds
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Division Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                    <select
                      className="form-control"
                      style={{ width: '150px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      value={divisionParam}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      aria-label="Filter roster by division"
                    >
                      <option value="">All Divisions</option>
                      <option value="A">Division A</option>
                      <option value="B">Division B</option>
                      <option value="C">Division C</option>
                      <option value="D">Division D</option>
                    </select>
                  </div>

                  <a
                    href={getSubjectFailuresExportUrl(courseCode || '', divisionParam || null)}
                    download
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Export confirmed subject failures roster as CSV"
                  >
                    <Download size={14} /> Export Failures (CSV)
                  </a>
                </div>
              </div>
            </div>

            {/* Course Metrics Ribbon */}
            <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#fafbfc', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <div>
                Enrolled: <strong>{data.total_enrolled}</strong>
              </div>
              <div style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle size={14} style={{ color: '#10b981' }} />
                Passed: <strong>{data.passed_count}</strong>
              </div>
              <div style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                Confirmed Failures: <strong>{data.confirmed_failures_count}</strong>
              </div>
              {data.unresolved_count > 0 && (
                <div style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <HelpCircle size={14} style={{ color: '#f59e0b' }} />
                  Unresolved: <strong>{data.unresolved_count}</strong>
                </div>
              )}
              <div style={{ marginLeft: 'auto', fontWeight: 700, color: data.confirmed_failures_count > 0 ? '#b91c1c' : '#10b981' }}>
                Failure Rate: {data.failure_rate_percent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Roster Table or Zero Failures Message */}
          {data.confirmed_failures_count === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <ShieldCheck size={32} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#065f46', marginBottom: '0.4rem' }}>
                  Zero Confirmed Failures
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
                  All <strong>{data.total_enrolled}</strong> enrolled students evaluated for {data.course_name}
                  {divisionParam ? ` in Division ${divisionParam}` : ''} successfully passed or are unresolved.
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                  <span>Confirmed Failing Students Roster</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {data.failing_students.length} of {data.confirmed_failures_count} confirmed failing students
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Roll / Seat No</th>
                      <th>Student Name</th>
                      <th>Division</th>
                      <th>Component Scores</th>
                      <th>Total Marks</th>
                      <th>Grade</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.failing_students.map((student: FailingStudentItem) => {
                      const componentEntries = Object.entries(student.components || {})

                      return (
                        <tr key={student.student_id}>
                          <td style={{ fontWeight: 600 }}>
                            {student.roll_no || student.seat_no || student.student_id}
                            {student.roll_no && student.seat_no && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Seat: {student.seat_no}
                              </div>
                            )}
                          </td>

                          <td>
                            <Link
                              to={`/students/${encodeURIComponent(student.student_id)}`}
                              style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'none' }}
                              className="hover-underline"
                            >
                              {student.name}
                            </Link>
                            {student.is_absent && (
                              <span className="badge badge-danger" style={{ fontSize: '0.65rem', marginLeft: '0.4rem' }}>
                                ABSENT
                              </span>
                            )}
                            {student.flags && student.flags.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem' }}>
                                {student.flags.map((flag, idx) => (
                                  <span key={idx} className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                                    {flag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td>{student.division || '—'}</td>

                          <td>
                            {componentEntries.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {componentEntries.map(([name, score]: [string, ComponentScoreSchema]) => {
                                  const display = score.state === 'marked'
                                    ? score.marks !== null ? score.marks : score.raw_text
                                    : score.state === 'flagged' ? (score.flag || 'Flagged')
                                    : score.state === 'not_enrolled' ? 'N/E'
                                    : (score.raw_text || score.state)

                                  return (
                                    <span
                                      key={name}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.15rem 0.4rem',
                                        backgroundColor: '#f1f5f9',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid #cbd5e1',
                                      }}
                                    >
                                      <strong style={{ color: '#475569' }}>{name}:</strong> {display}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {student.total_marks != null ? student.total_marks : '—'}
                          </td>

                          <td>
                            {student.letter_grade ? (
                              <span className="badge badge-danger">{student.letter_grade}</span>
                            ) : (
                              <span className="badge badge-danger">F</span>
                            )}
                            {student.failure_reason && (
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem' }}>
                                {student.failure_reason}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <Link
                              to={`/students/${encodeURIComponent(student.student_id)}`}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <span>Full Breakdown</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {data.failing_students.length > 0 ? (pageParam - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(pageParam * pageSize, data.confirmed_failures_count)} of {data.confirmed_failures_count} records
                </div>
                <Pagination
                  currentPage={pageParam}
                  totalItems={data.confirmed_failures_count}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
