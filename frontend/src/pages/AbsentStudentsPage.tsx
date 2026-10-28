import { Listbox } from '../ui/Listbox'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UserX, Filter, Download, Printer, AlertTriangle, BookOpen, Users } from 'lucide-react'
import {
  getAbsentStudents,
  getAbsentComponents,
  getSubjects,
  downloadAbsentStudentsExcel,
} from '../api/client'
import { exportAbsentStudents } from '../utils/excelExport'
import {
  ApiError,
  type AbsentStudentItem,
  type AbsentStudentsParams,
  type CourseItem,
  type PaginatedResponse,
} from '../api/types'
import { SearchBar } from '../components/SearchBar'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'

export const AbsentStudentsPage: React.FC = () => {
  const [records, setRecords] = useState<AbsentStudentItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [courseFilter, setCourseFilter] = useState<string>('')
  const [componentFilter, setComponentFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 25

  // Filter Dropdown options
  const [availableCourses, setAvailableCourses] = useState<CourseItem[]>([])
  const [availableComponents, setAvailableComponents] = useState<string[]>([])

  // Export & Print State
  const [exporting, setExporting] = useState<boolean>(false)
  const [printing, setPrinting] = useState<boolean>(false)
  const [printRecords, setPrintRecords] = useState<AbsentStudentItem[] | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch filter dropdown options once on mount
  useEffect(() => {
    let active = true
    Promise.allSettled([
      getSubjects({ limit: 100 }),
      getAbsentComponents(),
    ]).then(([subjectsRes, compRes]) => {
      if (!active) return
      if (subjectsRes.status === 'fulfilled') {
        setAvailableCourses(subjectsRes.value.items || [])
      }
      if (compRes.status === 'fulfilled') {
        setAvailableComponents(compRes.value || [])
      }
    })
    return () => {
      active = false
    }
  }, [])

  const fetchAbsentList = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const params: AbsentStudentsParams = {
      query: searchQuery.trim() || undefined,
      division: divisionFilter.trim() || undefined,
      course_code: courseFilter.trim() || undefined,
      component: componentFilter.trim() || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    try {
      const data: PaginatedResponse<AbsentStudentItem> = await getAbsentStudents(params, controller.signal)
      setRecords(data.items || [])
      setTotal(data.total || 0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve absent student records'))
      }
    } finally {
      setLoading(false)
    }
  }, [searchQuery, divisionFilter, courseFilter, componentFilter, page])

  useEffect(() => {
    fetchAbsentList()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchAbsentList])

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDivisionFilter(e.target.value)
    setPage(1)
  }

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCourseFilter(e.target.value)
    setPage(1)
  }

  const handleComponentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setComponentFilter(e.target.value)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setDivisionFilter('')
    setCourseFilter('')
    setComponentFilter('')
    setPage(1)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const isFiltered = Boolean(searchQuery.trim() || divisionFilter.trim() || courseFilter.trim() || componentFilter.trim())
      // 1. Try server-side real .xlsx endpoint
      try {
        const blob = await downloadAbsentStudentsExcel({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          course_code: courseFilter.trim() || undefined,
          component: componentFilter.trim() || undefined,
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = isFiltered ? 'EduQuery_Absent_Students_Filtered.xlsx' : 'EduQuery_Absent_Students.xlsx'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        return
      } catch (serverErr) {
        console.warn('Server-side absent xlsx export failed, falling back to client CSV export', serverErr)
      }

      // 2. Client-side fallback to RFC 4180 CSV
      let recordsToExport: AbsentStudentItem[] = []
      if (records.length >= total && records.length > 0) {
        recordsToExport = records
      } else if (total <= 100) {
        const fullList = await getAbsentStudents({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          course_code: courseFilter.trim() || undefined,
          component: componentFilter.trim() || undefined,
          limit: Math.min(Math.max(total, 1), 100),
          offset: 0,
        })
        recordsToExport = fullList?.items && fullList.items.length > 0 ? fullList.items : records
      } else {
        const batchSize = 100
        const pagesNeeded = Math.ceil(total / batchSize)
        const fetchPromises = []
        for (let i = 0; i < pagesNeeded; i++) {
          fetchPromises.push(
            getAbsentStudents({
              query: searchQuery.trim() || undefined,
              division: divisionFilter.trim() || undefined,
              course_code: courseFilter.trim() || undefined,
              component: componentFilter.trim() || undefined,
              limit: batchSize,
              offset: i * batchSize,
            })
          )
        }
        const pages = await Promise.all(fetchPromises)
        const allItems = pages.flatMap((p) => p.items || [])
        recordsToExport = allItems.length > 0 ? allItems : records
      }
      exportAbsentStudents(recordsToExport, isFiltered)
    } catch {
      alert('Failed to export absent students to Excel. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrintRoster = async () => {
    setPrinting(true)
    try {
      if (records.length >= total && records.length > 0) {
        setPrintRecords(records)
      } else if (total <= 100) {
        const fullList = await getAbsentStudents({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          course_code: courseFilter.trim() || undefined,
          component: componentFilter.trim() || undefined,
          limit: Math.min(Math.max(total, 1), 100),
          offset: 0,
        })
        setPrintRecords(fullList?.items && fullList.items.length > 0 ? fullList.items : records)
      } else {
        const batchSize = 100
        const pagesNeeded = Math.ceil(Math.min(total, 1000) / batchSize)
        const fetchPromises = []
        for (let i = 0; i < pagesNeeded; i++) {
          fetchPromises.push(
            getAbsentStudents({
              query: searchQuery.trim() || undefined,
              division: divisionFilter.trim() || undefined,
              course_code: courseFilter.trim() || undefined,
              component: componentFilter.trim() || undefined,
              limit: batchSize,
              offset: i * batchSize,
            })
          )
        }
        const pages = await Promise.all(fetchPromises)
        const allItems = pages.flatMap((p) => p?.items || [])
        setPrintRecords(allItems.length > 0 ? allItems : records)
      }
    } catch {
      setPrintRecords(records)
    } finally {
      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 150)
    }
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() || divisionFilter.trim() || courseFilter.trim() || componentFilter.trim()
  )

  const recordsToPrint = printRecords && printRecords.length > 0 ? printRecords : records

  // Compute summary stats from current visible page records
  const uniqueStudentCount = new Set(records.map((r) => r.student_id)).size
  const uniqueCourseCount = new Set(records.map((r) => r.course_code)).size

  return (
    <div>
      <style>{`
        @media screen {
          .print-absent-view {
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
          .sidebar, .top-bar, .top-header, .header, .card, nav, button, select, input, .pagination, .stats-row {
            display: none !important;
          }
          .print-absent-view, .print-absent-view * {
            visibility: visible;
          }
          .print-absent-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
          }
          .print-absent-view table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-absent-view thead {
            display: table-header-group !important;
          }
          .print-absent-view tbody {
            display: table-row-group !important;
          }
          .print-absent-view tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-absent-view th, .print-absent-view td {
            display: table-cell !important;
            border: 1px solid #94a3b8 !important;
            padding: 4px 6px !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
          }
          .print-absent-view th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            text-align: left;
          }
        }
      `}</style>

      {/* Header & Controls Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserX size={20} style={{ color: '#d97706' }} />
                  Absent Students Audit
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Authoritative log of students with recorded absent markers (A, AB, ABS, ABSENT) in examination components.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {hasActiveFilters ? (
                    <span>Filtered Incidents: <strong>{total.toLocaleString()}</strong></span>
                  ) : (
                    <span>Total Incidents: <strong>{total.toLocaleString()}</strong></span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting || total === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Export filtered absent records to Excel (.xlsx)"
                >
                  <Download size={14} />
                  <span>{exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintRoster}
                  disabled={printing || total === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Print complete absent students roster"
                >
                  <Printer size={14} />
                  <span>{printing ? 'Preparing Print...' : 'Print Roster'}</span>
                </button>
              </div>
            </div>

            {/* Quick Stat Highlights */}
            {total > 0 && (
              <div
                className="stats-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <AlertTriangle size={18} style={{ color: '#d97706' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>
                      Absence Records
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
                      {total.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={18} style={{ color: '#d97706' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>
                      Students on Page
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
                      {uniqueStudentCount}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <BookOpen size={18} style={{ color: '#d97706' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>
                      Subjects on Page
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
                      {uniqueCourseCount}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 240px' }}>
                <SearchBar
                  placeholder="Search by student name, roll no, seat no..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  loading={loading}
                />
              </div>

              {/* Division Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '150px' }}>
                <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                <Listbox
                  options={[
                    { value: '', label: 'All Divisions' },
                    { value: 'A', label: 'Division A' },
                    { value: 'B', label: 'Division B' },
                    { value: 'C', label: 'Division C' },
                    { value: 'D', label: 'Division D' },
                  ]}
                  value={divisionFilter}
                  onChange={(val) => handleDivisionChange({ target: { value: val } } as any)}
                  size="sm"
                  ariaLabel="Filter by Division"
                />
              </div>

              {/* Course Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '180px' }}>
                <Listbox
                  options={[
                    { value: '', label: 'All Subjects' },
                    ...availableCourses.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))
                  ]}
                  value={courseFilter}
                  onChange={(val) => handleCourseChange({ target: { value: val } } as any)}
                  size="sm"
                  ariaLabel="Filter by Subject"
                />
              </div>

              {/* Component Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '160px' }}>
                <Listbox
                  options={[
                    { value: '', label: 'All Components' },
                    ...availableComponents.map((comp) => ({ value: comp, label: comp }))
                  ]}
                  value={componentFilter}
                  onChange={(val) => handleComponentChange({ target: { value: val } } as any)}
                  size="sm"
                  ariaLabel="Filter by Component"
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetFilters}
                  style={{ fontSize: '0.8rem' }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <ErrorBanner
          error={error}
          title="Could not load absent student records"
          onRetry={fetchAbsentList}
        />
      )}

      {loading && !records.length ? (
        <LoadingState message="Fetching absent records from database..." />
      ) : !loading && !records.length ? (
        <EmptyState
          icon={<UserX size={44} style={{ color: '#d97706' }} />}
          title="No Absent Students Found"
          message={
            hasActiveFilters
              ? 'No absent records matched your specified filters. Try clearing your search or selecting different options.'
              : 'No student absence records (A, AB, ABS, ABSENT) were detected in the active marksheet dataset.'
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
              >
                Reset All Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>Roll / Seat No</th>
                  <th style={{ width: '18%' }}>Student Name</th>
                  <th style={{ width: '6%' }}>Div</th>
                  <th style={{ width: '22%' }}>Subject</th>
                  <th style={{ width: '9%' }}>Component</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>Marker</th>
                  <th style={{ width: '13%' }}>Subjects (P / F / AB)</th>
                  <th style={{ width: '10%' }}>Overall Result</th>
                  <th style={{ width: '0%', display: 'none' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item, idx) => {
                  const identifier = item.student_id
                  const outcome = (item.overall_result || '').toUpperCase()
                  const statusType =
                    outcome.includes('PASS')
                      ? 'passed'
                      : outcome.includes('FAIL')
                      ? 'failed'
                      : 'unresolved'

                  return (
                    <tr key={`${item.student_id}-${item.course_code}-${item.component}-${idx}`}>
                      <td style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.roll_no || item.seat_no || item.student_id}
                        {item.roll_no && item.seat_no && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Seat: {item.seat_no}
                          </div>
                        )}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/students/${encodeURIComponent(identifier)}`}
                          style={{ color: 'var(--text-main)', fontWeight: 600, textDecoration: 'none' }}
                          className="hover-underline"
                          title={item.name}
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td>{item.division || '—'}</td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/subjects/${encodeURIComponent(item.course_code)}`}
                          style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 600 }}
                          className="hover-underline"
                          title={`${item.course_code} - ${item.course_name}`}
                        >
                          {item.course_code}
                        </Link>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.course_name}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge badge-neutral"
                          style={{ fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {item.component}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge badge-warning"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          {item.raw_text || 'AB'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', fontWeight: 600 }}
                            title="Passed Distinct Subjects"
                          >
                            {item.passed_subject_count ?? 0} P
                          </span>
                          <span
                            className="badge badge-danger"
                            style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', fontWeight: 600 }}
                            title="Failed Distinct Subjects"
                          >
                            {item.failed_subject_count ?? 0} F
                          </span>
                          <span
                            className="badge badge-warning"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 600,
                            }}
                            title="Distinct Subjects with Absent Marks"
                          >
                            {item.absent_subject_count ?? 0} AB
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={statusType} text={item.overall_result || 'UNRESOLVED'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {records.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total.toLocaleString()} records
            </div>
            <Pagination
              currentPage={page}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </div>
      )}

      {/* Print-Only Roster Section */}
      {printing && recordsToPrint && recordsToPrint.length > 0 && (
        <div className="print-absent-view">
          <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '16pt', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#0f172a' }}>
              EduQuery — Absent Students Audit Roster
            </h1>
            <div style={{ fontSize: '9pt', color: '#475569' }}>
              Generated: {new Date().toLocaleDateString()} &bull; Total Matching Records: {total}
              {hasActiveFilters && (
                <div style={{ marginTop: '0.2rem' }}>
                  Active Filters:
                  {searchQuery && ` Query: "${searchQuery}"`}
                  {divisionFilter && ` | Division: ${divisionFilter}`}
                  {courseFilter && ` | Course: ${courseFilter}`}
                  {componentFilter && ` | Component: ${componentFilter}`}
                </div>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '5px 6px', width: '10%' }}>Roll No</th>
                <th style={{ padding: '5px 6px', width: '9%' }}>Seat No</th>
                <th style={{ padding: '5px 6px', width: '20%' }}>Student Name</th>
                <th style={{ padding: '5px 6px', width: '5%', textAlign: 'center' }}>Div</th>
                <th style={{ padding: '5px 6px', width: '20%' }}>Subject</th>
                <th style={{ padding: '5px 6px', width: '8%' }}>Component</th>
                <th style={{ padding: '5px 6px', width: '6%', textAlign: 'center' }}>Marker</th>
                <th style={{ padding: '5px 6px', width: '6%', textAlign: 'center' }}>Passed</th>
                <th style={{ padding: '5px 6px', width: '6%', textAlign: 'center' }}>Failed</th>
                <th style={{ padding: '5px 6px', width: '6%', textAlign: 'center' }}>Absent</th>
                <th style={{ padding: '5px 6px', width: '10%' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {recordsToPrint.map((r, i) => (
                <tr key={`print-${r.student_id}-${r.course_code}-${r.component}-${i}`}>
                  <td style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.roll_no || '—'}</td>
                  <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{r.seat_no || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{r.name}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{r.division || '—'}</td>
                  <td style={{ padding: '4px 6px' }}>{r.course_code} - {r.course_name}</td>
                  <td style={{ padding: '4px 6px' }}>{r.component}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: '#92400e' }}>
                    {r.raw_text || 'AB'}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: '#065f46' }}>
                    {r.passed_subject_count ?? 0}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: (r.failed_subject_count ?? 0) > 0 ? '#991b1b' : '#64748b' }}>
                    {r.failed_subject_count ?? 0}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: (r.absent_subject_count ?? 0) > 0 ? '#92400e' : '#64748b' }}>
                    {r.absent_subject_count ?? 0}
                  </td>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{r.overall_result || 'UNRESOLVED'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
