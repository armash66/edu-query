import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  Filter,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  Download,
  Search,
  UserX,
  BookOpen,
} from 'lucide-react'
import {
  getSubjectStudents,
  downloadSubjectStudentsExcel,
  saveBlobAsFile,
} from '../api/client'
import {
  ApiError,
  type SubjectStudentsResponse,
  type SubjectStudentItem,
  type ComponentScoreSchema,
} from '../api/types'
import { Pagination } from '../components/Pagination'
import { LoadingState } from '../components/LoadingState'
import { ErrorBanner } from '../components/ErrorBanner'

export const SubjectDetailPage: React.FC = () => {
  const { courseCode } = useParams<{ courseCode: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const divisionParam = searchParams.get('division') || ''
  const statusParam = (searchParams.get('status') as 'all' | 'passed' | 'failed' | 'absent') || 'all'
  const searchParam = searchParams.get('search') || ''
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  const [data, setData] = useState<SubjectStudentsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const [exportingType, setExportingType] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState<string>(searchParam)

  const pageSize = 25
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchCourseStudents = useCallback(async () => {
    if (!courseCode) return
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const res = await getSubjectStudents(courseCode, {
        division: divisionParam.trim() || undefined,
        status: statusParam,
        search: searchParam.trim() || undefined,
        limit: pageSize,
        offset: (pageParam - 1) * pageSize,
      })
      setData(res)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve subject student roster'))
      }
    } finally {
      setLoading(false)
    }
  }, [courseCode, divisionParam, statusParam, searchParam, pageParam])

  useEffect(() => {
    fetchCourseStudents()
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [fetchCourseStudents])

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

  const handleStatusChange = (newStatus: 'all' | 'passed' | 'failed' | 'absent') => {
    const nextParams = new URLSearchParams(searchParams)
    if (newStatus !== 'all') {
      nextParams.set('status', newStatus)
    } else {
      nextParams.delete('status')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nextParams = new URLSearchParams(searchParams)
    if (searchInput.trim()) {
      nextParams.set('search', searchInput.trim())
    } else {
      nextParams.delete('search')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('page', String(newPage))
    setSearchParams(nextParams)
  }

  const handleExportExcel = async (type: 'all' | 'passed' | 'failed' | 'absent') => {
    if (!courseCode) return
    setExportingType(type)
    try {
      const safeCode = courseCode.replace(/[^a-zA-Z0-9_-]/g, '_')
      let filename = `EduQuery_${safeCode}_All_Students.xlsx`
      if (type === 'passed') {
        filename = `EduQuery_${safeCode}_Passed_Students.xlsx`
      } else if (type === 'failed') {
        filename = `EduQuery_${safeCode}_Failed_Students.xlsx`
      } else if (type === 'absent') {
        filename = `EduQuery_${safeCode}_Absent_Students.xlsx`
      }

      const blob = await downloadSubjectStudentsExcel(
        courseCode,
        type,
        divisionParam.trim() || null
      )
      saveBlobAsFile(blob, filename)
    } catch {
      alert(`Failed to download ${type} students Excel workbook. Please try again.`)
    } finally {
      setExportingType(null)
    }
  }

  if (loading && !data) {
    return <LoadingState message={`Retrieving student roster for subject "${courseCode}"...`} />
  }

  // Filter matching count
  let displayedTotal = data?.total_enrolled ?? 0
  if (statusParam === 'passed') displayedTotal = data?.passed_count ?? 0
  else if (statusParam === 'failed') displayedTotal = data?.failed_count ?? 0
  else if (statusParam === 'absent') displayedTotal = data?.absent_count ?? 0

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Link
          to="/subjects"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowLeft size={14} /> Back to Course Catalog
        </Link>
      </div>

      {error && (
        <ErrorBanner
          error={error}
          title="Could not load subject roster"
          onRetry={fetchCourseStudents}
        />
      )}

      {data && (
        <>
          {/* Course Details Header Card */}
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
                    Unified student evaluation roster showing passed, failed, and absent candidates
                  </div>
                </div>

                {/* One-Click Excel Reports */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleExportExcel('all')}
                    disabled={exportingType !== null}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Download complete subject enrollment as Excel (.xlsx)"
                  >
                    <Download size={14} />
                    <span>{exportingType === 'all' ? 'Exporting...' : 'All Students (.xlsx)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportExcel('passed')}
                    disabled={exportingType !== null || data.passed_count === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#065f46' }}
                    title="Download passed students as Excel (.xlsx)"
                  >
                    <Download size={14} />
                    <span>{exportingType === 'passed' ? 'Exporting...' : 'Passed Students (.xlsx)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportExcel('failed')}
                    disabled={exportingType !== null || data.failed_count === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#991b1b' }}
                    title="Download confirmed failed students as Excel (.xlsx)"
                  >
                    <Download size={14} />
                    <span>{exportingType === 'failed' ? 'Exporting...' : 'Failed Students (.xlsx)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportExcel('absent')}
                    disabled={exportingType !== null || data.absent_count === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#d97706' }}
                    title="Download absent students as Excel (.xlsx)"
                  >
                    <Download size={14} />
                    <span>{exportingType === 'absent' ? 'Exporting...' : 'Absent Students (.xlsx)'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Course Metrics Ribbon */}
            <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#fafbfc', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <div>
                Total Enrolled: <strong>{data.total_enrolled}</strong>
              </div>
              <div style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle size={14} style={{ color: '#10b981' }} />
                Passed: <strong>{data.passed_count}</strong>
              </div>
              <div style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                Failed: <strong>{data.failed_count}</strong>
              </div>
              <div style={{ color: (data.absent_count ?? 0) > 0 ? '#92400e' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <UserX size={14} style={{ color: (data.absent_count ?? 0) > 0 ? '#d97706' : '#94a3b8' }} />
                Absent: <strong>{data.absent_count ?? 0}</strong>
              </div>
              <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <HelpCircle size={14} style={{ color: '#94a3b8' }} />
                Unclassified: <strong>{data.unresolved_count ?? 0}</strong>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 700, color: data.pass_percentage >= 50 ? '#059669' : '#b91c1c' }}>
                  Pass Percentage: {data.pass_percentage.toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={data.denominator_explanation}>
                  {data.denominator_explanation || 'Passed / (Passed + Failed) [excludes absent and unclassified records]'}
                </span>
              </div>
            </div>
          </div>

          {/* Filters & Search Control Card */}
          <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 260px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by student name, roll no, or seat no..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{ paddingLeft: '2rem', fontSize: '0.82rem' }}
                  />
                </div>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Search
                </button>
              </form>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-xs ${statusParam === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleStatusChange('all')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                >
                  All ({data.total_enrolled})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${statusParam === 'passed' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleStatusChange('passed')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                >
                  Passed ({data.passed_count})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${statusParam === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleStatusChange('failed')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                >
                  Failed ({data.failed_count})
                </button>
                {data.absent_count > 0 && (
                  <button
                    type="button"
                    className={`btn btn-xs ${statusParam === 'absent' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleStatusChange('absent')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  >
                    Absent ({data.absent_count})
                  </button>
                )}
              </div>

              {/* Division Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={14} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="form-control"
                  style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
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
            </div>
          </div>

          {/* Unified Student Table */}
          {data.students.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <BookOpen size={28} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                  No Students Found
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 1rem auto' }}>
                  No student records matched the current filter criteria (Status: {statusParam}
                  {divisionParam ? `, Division: ${divisionParam}` : ''}
                  {searchParam ? `, Search: "${searchParam}"` : ''}).
                </p>
                {(statusParam !== 'all' || divisionParam || searchParam) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSearchInput('')
                      setSearchParams(new URLSearchParams())
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Roll / Seat No</th>
                      <th style={{ width: '25%' }}>Student Name</th>
                      <th style={{ width: '10%' }}>Division</th>
                      <th style={{ width: '22%' }}>Component Scores</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Total Marks</th>
                      <th style={{ width: '14%' }}>Result Status</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student: SubjectStudentItem) => {
                      const componentEntries = Object.entries(student.components || {})

                      let badgeClass = 'badge-neutral'
                      if (student.status === 'Passed') badgeClass = 'badge-success'
                      else if (student.status === 'Failed') badgeClass = 'badge-danger'
                      else if (student.status === 'Absent') badgeClass = 'badge-warning'

                      return (
                        <tr key={student.student_id}>
                          <td style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {student.roll_no || student.seat_no || student.student_id}
                            {student.roll_no && student.seat_no && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Seat: {student.seat_no}
                              </div>
                            )}
                          </td>

                          <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link
                              to={`/students/${encodeURIComponent(student.student_id)}`}
                              style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'none' }}
                              className="hover-underline"
                              title={student.name}
                            >
                              {student.name}
                            </Link>
                            {student.warning && (
                              <div style={{ fontSize: '0.68rem', color: '#b45309', marginTop: '0.15rem' }}>
                                {student.warning}
                              </div>
                            )}
                            {student.failure_reason && student.status === 'Failed' && (
                              <div style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: '0.15rem' }}>
                                {student.failure_reason}
                              </div>
                            )}
                          </td>

                          <td>{student.division || '—'}</td>

                          <td>
                            {componentEntries.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {componentEntries.map(([name, score]: [string, ComponentScoreSchema]) => {
                                  const display =
                                    score.state === 'marked'
                                      ? score.marks !== null
                                        ? score.marks
                                        : score.raw_text
                                      : score.state === 'flagged'
                                      ? score.flag || 'Flagged'
                                      : score.state === 'not_enrolled'
                                      ? 'N/E'
                                      : score.raw_text || score.state

                                  return (
                                    <span
                                      key={name}
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.1rem 0.35rem',
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

                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                            {student.total_marks != null ? student.total_marks : '—'}
                            {student.max_marks != null && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {' '}/ {student.max_marks}
                              </span>
                            )}
                          </td>

                          <td>
                            <span className={`badge ${badgeClass}`}>
                              {student.status}
                            </span>
                            {student.letter_grade && student.status !== 'Absent' && (
                              <span className="badge badge-neutral" style={{ marginLeft: '0.35rem', fontSize: '0.7rem' }}>
                                {student.letter_grade}
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <Link
                              to={`/students/${encodeURIComponent(student.student_id)}`}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <span>Breakdown</span>
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
                  Showing {data.students.length > 0 ? (pageParam - 1) * pageSize + 1 : 0} to{' '}
                  {Math.min(pageParam * pageSize, displayedTotal)} of {displayedTotal} records
                </div>
                <Pagination
                  currentPage={pageParam}
                  totalItems={displayedTotal}
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
