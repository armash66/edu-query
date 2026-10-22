import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Users, Filter, ArrowUpRight, GraduationCap, Download, Printer } from 'lucide-react'
import { getStudents, downloadStudentsRosterExcel, saveBlobAsFile, type StudentListParams } from '../api/client'
import { ApiError, type StudentSummaryItem, type PaginatedResponse } from '../api/types'
import { SearchBar } from '../components/SearchBar'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentSummaryItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 25

  // Export & Print State
  const [exporting, setExporting] = useState<boolean>(false)
  const [printing, setPrinting] = useState<boolean>(false)
  const [printStudents, setPrintStudents] = useState<StudentSummaryItem[] | null>(null)

  // Abort controller ref to cancel obsolete in-flight searches
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchStudentList = useCallback(async () => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const params: StudentListParams = {
      query: searchQuery.trim() || undefined,
      division: divisionFilter.trim() || undefined,
      result: resultFilter.trim() || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    try {
      const data: PaginatedResponse<StudentSummaryItem> = await getStudents(params, controller.signal)
      setStudents(data.items || [])
      setTotal(data.total || 0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Obsolete request canceled, ignore
        return
      }
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve students roster'))
      }
    } finally {
      setLoading(false)
    }
  }, [searchQuery, divisionFilter, resultFilter, page])

  useEffect(() => {
    fetchStudentList()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchStudentList])

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDivisionFilter(e.target.value)
    setPage(1)
  }

  const handleResultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setResultFilter(e.target.value)
    setPage(1)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const blob = await downloadStudentsRosterExcel({
        query: searchQuery.trim() || undefined,
        division: divisionFilter.trim() || undefined,
        result: resultFilter.trim() || undefined,
      })
      const isFiltered = Boolean(searchQuery.trim() || divisionFilter.trim() || resultFilter.trim())
      const filename = isFiltered ? 'student_roster_filtered.xlsx' : 'student_roster.xlsx'
      saveBlobAsFile(blob, filename)
    } catch {
      alert('Failed to export student roster to Excel. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrintRoster = async () => {
    setPrinting(true)
    try {
      if (students.length >= total) {
        setPrintStudents(students)
      } else {
        const fullList = await getStudents({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          result: resultFilter.trim() || undefined,
          limit: 2000,
          offset: 0,
        })
        setPrintStudents(fullList.items || [])
      }

      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 250)
    } catch {
      setPrinting(false)
      window.print()
    }
  }

  const hasActiveFilters = Boolean(searchQuery.trim() || divisionFilter.trim() || resultFilter.trim())

  return (
    <div>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-roster-view, .print-roster-view * {
            visibility: visible;
            display: block !important;
          }
          .print-roster-view {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-roster-view table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-roster-view thead {
            display: table-header-group !important;
          }
          .print-roster-view tr {
            display: table-row !important;
            page-break-inside: avoid;
          }
          .print-roster-view th, .print-roster-view td {
            display: table-cell !important;
            border: 1px solid #cbd5e1 !important;
            padding: 5px 8px !important;
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
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  Student Marks Roster
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Search student cohort by Roll No, Seat No, or Name. Click any student to view detailed component marks.
                </div>
              </div>

              {/* Scope & Count Badge + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {hasActiveFilters ? (
                    <span>Filtered Matching: <strong>{total.toLocaleString()}</strong> students</span>
                  ) : (
                    <span>Total Verified: <strong>{total.toLocaleString()}</strong> students</span>
                  )}
                </div>

                {/* Export to Excel (.xlsx) */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting || total === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Export filtered student roster to Excel (.xlsx)"
                >
                  <Download size={14} />
                  <span>{exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}</span>
                </button>

                {/* Print Roster */}
                <button
                  type="button"
                  onClick={handlePrintRoster}
                  disabled={printing || total === 0}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Print complete filtered student roster"
                >
                  <Printer size={14} />
                  <span>{printing ? 'Preparing Print...' : 'Print Roster'}</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px' }}>
                <SearchBar
                  placeholder="Search by student name, roll no, or seat no..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  loading={loading}
                />
              </div>

              {/* Division Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="form-control"
                  style={{ width: '130px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  value={divisionFilter}
                  onChange={handleDivisionChange}
                  aria-label="Filter by Division"
                >
                  <option value="">All Divisions</option>
                  <option value="A">Division A</option>
                  <option value="B">Division B</option>
                  <option value="C">Division C</option>
                  <option value="D">Division D</option>
                </select>
              </div>

              {/* Result Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  className="form-control"
                  style={{ width: '150px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  value={resultFilter}
                  onChange={handleResultChange}
                  aria-label="Filter by Result"
                >
                  <option value="">All Outcomes</option>
                  <option value="PASS">Passed (PASS)</option>
                  <option value="FAIL">Failed (FAIL)</option>
                  <option value="UNRESOLVED">Unresolved</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchQuery('')
                    setDivisionFilter('')
                    setResultFilter('')
                    setPage(1)
                  }}
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
          title="Could not load student roster"
          onRetry={fetchStudentList}
        />
      )}

      {loading && !students.length ? (
        <LoadingState message="Fetching student roster from database..." />
      ) : !loading && !students.length ? (
        <EmptyState
          icon={<GraduationCap size={44} />}
          title="No Students Found"
          message={
            hasActiveFilters
              ? "No student records matched your specified search filters. Try clearing filters or searching with a different term."
              : "No students are currently ingested in the active dataset. Please import a marksheet to begin."
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('')
                  setDivisionFilter('')
                  setResultFilter('')
                  setPage(1)
                }}
              >
                Reset All Filters
              </button>
            ) : (
              <Link to="/upload" className="btn btn-primary btn-sm">
                Upload Marksheet
              </Link>
            )
          }
        />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Roll / Seat No</th>
                  <th style={{ width: '25%' }}>Student Name</th>
                  <th style={{ width: '10%' }}>Division</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Total Marks</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>SGPI / CGPA</th>
                  <th style={{ width: '14%' }}>Overall Outcome</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const identifier = student.student_id
                  const outcome = (student.overall_result || '').toUpperCase()
                  const statusType =
                    outcome.includes('PASS')
                      ? 'passed'
                      : outcome.includes('FAIL')
                      ? 'failed'
                      : 'unresolved'

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
                          to={`/students/${encodeURIComponent(identifier)}`}
                          style={{ color: 'var(--text-main)', fontWeight: 600, textDecoration: 'none' }}
                          className="hover-underline"
                          title={student.name}
                        >
                          {student.name}
                        </Link>
                      </td>
                      <td>{student.division || '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {student.total_marks != null ? student.total_marks : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {student.sgpi != null ? student.sgpi.toFixed(2) : student.cgpa != null ? student.cgpa.toFixed(2) : '—'}
                      </td>
                      <td>
                        <StatusBadge status={statusType} text={student.overall_result || 'UNRESOLVED'} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/students/${encodeURIComponent(identifier)}`}
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

          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {students.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
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
      {printing && printStudents && (
        <div className="print-roster-view" style={{ display: 'none' }}>
          <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0 0 0.25rem 0', color: '#0f172a' }}>
              EduQuery — Student Marks Roster
            </h1>
            <div style={{ fontSize: '9.5pt', color: '#475569' }}>
              Generated: {new Date().toLocaleDateString()} &bull; Total Matching Students: {total}
              {hasActiveFilters && (
                <div style={{ marginTop: '0.25rem' }}>
                  Active Filters:
                  {searchQuery && ` Query: "${searchQuery}"`}
                  {divisionFilter && ` | Division: ${divisionFilter}`}
                  {resultFilter && ` | Outcome: ${resultFilter}`}
                </div>
              )}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', width: '15%' }}>Roll / Seat</th>
                <th style={{ padding: '6px 8px', width: '30%' }}>Student Name</th>
                <th style={{ padding: '6px 8px', width: '10%' }}>Division</th>
                <th style={{ padding: '6px 8px', width: '15%', textAlign: 'right' }}>Total Marks</th>
                <th style={{ padding: '6px 8px', width: '15%', textAlign: 'right' }}>SGPI / CGPA</th>
                <th style={{ padding: '6px 8px', width: '15%' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {printStudents.map((st) => (
                <tr key={st.student_id}>
                  <td style={{ padding: '5px 8px', fontWeight: 600 }}>{st.roll_no || st.seat_no || st.student_id}</td>
                  <td style={{ padding: '5px 8px' }}>{st.name}</td>
                  <td style={{ padding: '5px 8px' }}>{st.division || '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{st.total_marks ?? '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                    {st.sgpi != null ? st.sgpi.toFixed(2) : st.cgpa != null ? st.cgpa.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '5px 8px' }}>{st.overall_result || 'UNRESOLVED'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
