import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  Filter,
  CheckCircle,
  HelpCircle,
  ArrowUpRight,
  Download,
  ChevronDown,
  Users,
  UserX,
  Search,
  BookOpen,
  Printer,
} from 'lucide-react'
import {
  getSubjectStudents,
} from '../api/client'
import { exportSubjectRoster } from '../utils/excelExport'
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
  const rawStatus = (searchParams.get('status') || searchParams.get('result') || 'all').toLowerCase()
  const statusParam = (rawStatus as 'all' | 'passed' | 'failed' | 'absent')
  const searchParam = searchParams.get('search') || ''
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  const [data, setData] = useState<SubjectStudentsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const [exportingType, setExportingType] = useState<string | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false)
  const [searchInput, setSearchInput] = useState<string>(searchParam)
  const [printing, setPrinting] = useState<boolean>(false)
  const [printStudents, setPrintStudents] = useState<SubjectStudentItem[] | null>(null)

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
        result: statusParam !== 'all' ? statusParam : undefined,
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

  // Filter matching count
  let displayedTotal = data?.total_enrolled ?? 0
  if (statusParam === 'passed') displayedTotal = data?.passed_count ?? 0
  else if (statusParam === 'failed') displayedTotal = data?.failed_count ?? 0
  else if (statusParam === 'absent') displayedTotal = data?.absent_count ?? 0

  const visibleStudents = useMemo(() => {
    if (!data?.students) return []
    if (statusParam === 'all') return data.students
    return data.students.filter((s) => {
      const st = (s.status || '').toLowerCase()
      if (statusParam === 'passed') return st === 'passed'
      if (statusParam === 'failed') return st === 'failed'
      if (statusParam === 'absent') return s.is_absent || st === 'absent'
      return true
    })
  }, [data?.students, statusParam])

  const studentsToPrint = printStudents && printStudents.length > 0 ? printStudents : visibleStudents

  const handlePrintRoster = async () => {
    if (!courseCode) return
    setPrinting(true)
    try {
      const currentList = visibleStudents
      const targetTotal = displayedTotal
      if (currentList.length >= targetTotal && currentList.length > 0) {
        setPrintStudents(currentList)
      } else if (targetTotal <= 100) {
        const fullRes = await getSubjectStudents(courseCode, {
          division: divisionParam.trim() || undefined,
          status: statusParam !== 'all' ? statusParam : undefined,
          result: statusParam !== 'all' ? statusParam : undefined,
          search: searchParam.trim() || undefined,
          limit: Math.min(Math.max(targetTotal, 1), 100),
          offset: 0,
        })
        const items = fullRes?.students || []
        const filtered = statusParam === 'all' ? items : items.filter((s) => {
          const st = (s.status || '').toLowerCase()
          if (statusParam === 'passed') return st === 'passed'
          if (statusParam === 'failed') return st === 'failed'
          if (statusParam === 'absent') return s.is_absent || st === 'absent'
          return true
        })
        setPrintStudents(filtered.length > 0 ? filtered : currentList)
      } else {
        const batchSize = 100
        const pagesNeeded = Math.ceil(Math.min(targetTotal, 1000) / batchSize)
        const fetchPromises = []
        for (let i = 0; i < pagesNeeded; i++) {
          fetchPromises.push(
            getSubjectStudents(courseCode, {
              division: divisionParam.trim() || undefined,
              status: statusParam !== 'all' ? statusParam : undefined,
              result: statusParam !== 'all' ? statusParam : undefined,
              search: searchParam.trim() || undefined,
              limit: batchSize,
              offset: i * batchSize,
            })
          )
        }
        const pages = await Promise.all(fetchPromises)
        const allItems = pages.flatMap((p) => p?.students || [])
        const filtered = statusParam === 'all' ? allItems : allItems.filter((s) => {
          const st = (s.status || '').toLowerCase()
          if (statusParam === 'passed') return st === 'passed'
          if (statusParam === 'failed') return st === 'failed'
          if (statusParam === 'absent') return s.is_absent || st === 'absent'
          return true
        })
        setPrintStudents(filtered.length > 0 ? filtered : currentList)
      }
    } catch {
      setPrintStudents(visibleStudents)
    } finally {
      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 150)
    }
  }

  const handleExportExcel = async (type: 'all' | 'passed' | 'failed' | 'absent') => {
    if (!courseCode) return
    setExportingType(type)
    try {
      let recordsToExport: SubjectStudentItem[] = []
      const currentList = data?.students || []
      const targetTotal =
        type === 'passed'
          ? (data?.passed_count ?? 0)
          : type === 'failed'
          ? (data?.failed_count ?? 0)
          : type === 'absent'
          ? (data?.absent_count ?? 0)
          : (data?.total_enrolled ?? 0)

      if (targetTotal <= 200) {
        const fullRes = await getSubjectStudents(courseCode, {
          division: divisionParam.trim() || undefined,
          result: type === 'all' ? undefined : type,
          status: type === 'all' ? undefined : type,
          limit: Math.min(Math.max(targetTotal, 1), 200),
          offset: 0,
        })
        recordsToExport = fullRes?.students || []
      } else {
        const batchSize = 200
        const pagesNeeded = Math.ceil(targetTotal / batchSize)
        const fetchPromises = []
        for (let i = 0; i < pagesNeeded; i++) {
          fetchPromises.push(
            getSubjectStudents(courseCode, {
              division: divisionParam.trim() || undefined,
              result: type === 'all' ? undefined : type,
              status: type === 'all' ? undefined : type,
              limit: batchSize,
              offset: i * batchSize,
            })
          )
        }
        const pages = await Promise.all(fetchPromises)
        recordsToExport = pages.flatMap((p) => p?.students || [])
      }

      if (recordsToExport.length === 0) {
        recordsToExport = currentList.filter((s) => {
          if (type === 'passed') return s.status === 'passed'
          if (type === 'failed') return s.status === 'failed'
          if (type === 'absent') return s.is_absent || s.status === 'absent'
          return true
        })
      }

      exportSubjectRoster(
        courseCode,
        data?.course_name || courseCode,
        type,
        recordsToExport,
        divisionParam.trim() || null
      )
    } catch {
      alert(`Failed to download ${type} students Excel workbook. Please try again.`)
    } finally {
      setExportingType(null)
    }
  }

  if (loading && !data) {
    return <LoadingState message={`Retrieving student roster for subject "${courseCode}"...`} />
  }



  return (
    <div>
      <style>{`
        @media screen {
          .print-subject-view {
            display: none !important;
          }
        }
        @page {
          size: landscape;
          margin: 10mm 12mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .sidebar, .top-bar, .top-header, .header, .card, nav, button, select, input, .pagination {
            display: none !important;
          }
          .print-subject-view, .print-subject-view * {
            visibility: visible;
          }
          .print-subject-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
          }
          .print-subject-view table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-subject-view thead {
            display: table-header-group !important;
          }
          .print-subject-view tbody {
            display: table-row-group !important;
          }
          .print-subject-view tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-subject-view th, .print-subject-view td {
            display: table-cell !important;
            border: 1px solid #cbd5e1 !important;
            padding: 5px 7px !important;
            font-size: 8.5pt !important;
            line-height: 1.3 !important;
          }
          .print-subject-view th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            text-align: left;
          }
        }
      `}</style>

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

                {/* Action Buttons: Print Roster & Export Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handlePrintRoster}
                    disabled={printing || displayedTotal === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                    title="Print complete filtered subject roster"
                  >
                    <Printer size={14} />
                    <span>{printing ? 'Preparing Print...' : 'Print Roster'}</span>
                  </button>

                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setExportMenuOpen((prev) => !prev)}
                      disabled={exportingType !== null}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                      title="Export subject roster to Excel (.xlsx)"
                      aria-expanded={exportMenuOpen}
                      aria-label="Export Course Roster Menu"
                    >
                      <Download size={14} />
                      <span>{exportingType ? 'Exporting...' : 'Export (.xlsx)'}</span>
                      <ChevronDown size={13} style={{ transform: exportMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>

                  {exportMenuOpen && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                        onClick={() => setExportMenuOpen(false)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 'calc(100% + 4px)',
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                          border: '1px solid #e2e8f0',
                          minWidth: '220px',
                          zIndex: 50,
                          padding: '0.35rem 0',
                          textAlign: 'left',
                        }}
                      >
                        <div
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#64748b',
                            borderBottom: '1px solid #f1f5f9',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Export {data.course_code} Rosters
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExportMenuOpen(false)
                            handleExportExcel('all')
                          }}
                          disabled={exportingType !== null}
                          className="dropdown-item-btn"
                          title="Download complete subject enrollment as Excel (.xlsx)"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                            color: '#1e293b',
                          }}
                        >
                          <Users size={14} style={{ color: '#0284c7' }} />
                          <span>All Students (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExportMenuOpen(false)
                            handleExportExcel('passed')
                          }}
                          disabled={exportingType !== null || data.passed_count === 0}
                          className="dropdown-item-btn"
                          title="Download passed students as Excel (.xlsx)"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            background: 'none',
                            border: 'none',
                            cursor: data.passed_count === 0 ? 'not-allowed' : 'pointer',
                            opacity: data.passed_count === 0 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                            color: '#065f46',
                          }}
                        >
                          <CheckCircle size={14} style={{ color: '#10b981' }} />
                          <span>Passed Students ({data.passed_count})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExportMenuOpen(false)
                            handleExportExcel('failed')
                          }}
                          disabled={exportingType !== null || data.failed_count === 0}
                          className="dropdown-item-btn"
                          title="Download confirmed failed students as Excel (.xlsx)"
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            background: 'none',
                            border: 'none',
                            cursor: data.failed_count === 0 ? 'not-allowed' : 'pointer',
                            opacity: data.failed_count === 0 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                            color: '#991b1b',
                          }}
                        >
                          <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                          <span>Failed Students ({data.failed_count})</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
          {visibleStudents.length === 0 ? (
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
                    {visibleStudents.map((student: SubjectStudentItem) => {
                      const componentEntries = Object.entries(student.components || {})

                      let badgeClass = 'badge-neutral'
                      const sStatus = (student.status || '').toLowerCase()
                      if (sStatus === 'passed') badgeClass = 'badge-success'
                      else if (sStatus === 'failed') badgeClass = 'badge-danger'
                      else if (sStatus === 'absent' || student.is_absent) badgeClass = 'badge-warning'

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
                  Showing {visibleStudents.length > 0 ? (pageParam - 1) * pageSize + 1 : 0} to{' '}
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

      {/* Dedicated Print-Only Subject Roster Section */}
      {printing && studentsToPrint && studentsToPrint.length > 0 && (
        <div className="print-subject-view">
          <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '16pt', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#0f172a' }}>
                  EduQuery — Subject Evaluation Roster
                </h1>
                <div style={{ fontSize: '11pt', fontWeight: 600, color: '#334155' }}>
                  {data?.course_code} — {data?.course_name}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#64748b' }}>
                <div>Printed: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div>Filter: {statusParam.toUpperCase()} {divisionParam ? `| Div: ${divisionParam}` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '8.5pt', color: '#475569' }}>
              <span>Total Enrolled: <strong>{data?.total_enrolled}</strong></span>
              <span>Passed: <strong>{data?.passed_count}</strong></span>
              <span>Failed: <strong>{data?.failed_count}</strong></span>
              <span>Absent: <strong>{data?.absent_count}</strong></span>
              <span>Pass Rate: <strong>{data?.pass_percentage.toFixed(1)}%</strong></span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '6%' }}>#</th>
                <th style={{ width: '12%' }}>Roll No</th>
                <th style={{ width: '12%' }}>Seat No</th>
                <th style={{ width: '26%' }}>Student Name</th>
                <th style={{ width: '6%', textAlign: 'center' }}>Div</th>
                <th style={{ width: '18%' }}>Component Marks</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Total</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {studentsToPrint.map((st, idx) => {
                const compStr = Object.entries(st.components || {})
                  .map(([name, score]) => `${name}: ${score.raw_text || (score.marks != null ? score.marks : '—')}`)
                  .join(', ')
                return (
                  <tr key={`print-subject-${st.student_id}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{st.roll_no || '—'}</td>
                    <td>{st.seat_no || '—'}</td>
                    <td>{st.name}</td>
                    <td style={{ textAlign: 'center' }}>{st.division || '—'}</td>
                    <td>{compStr || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{st.total_marks != null ? st.total_marks : '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: (st.status || '').toLowerCase() === 'passed' ? '#065f46' : (st.status || '').toLowerCase() === 'failed' ? '#991b1b' : '#92400e' }}>
                      {st.status}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
