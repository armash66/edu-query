import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  UserX,
  Download,
  Printer,
  AlertTriangle,
  BookOpen,
  Users,
  ArrowUpRight,
} from 'lucide-react'
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
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { SearchField } from '../ui/SearchField'
import { Listbox } from '../ui/Listbox'
import { DataTable, type Column } from '../ui/DataTable'
import { StatusBadge } from '../ui/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { toTitleCase } from '../utils/text'

export const AbsentStudentsPage: React.FC = () => {
  const [records, setRecords] = useState<AbsentStudentItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [totalCourses, setTotalCourses] = useState<number>(0)
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
      setTotalStudents(data.total_students ?? new Set((data.items || []).map((r) => r.student_id)).size)
      setTotalCourses(data.total_courses ?? new Set((data.items || []).map((r) => r.course_code)).size)
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const handleDivisionChange = (val: string) => {
    setDivisionFilter(val)
    setPage(1)
  }

  const handleCourseChange = (val: string) => {
    setCourseFilter(val)
    setPage(1)
  }

  const handleComponentChange = (val: string) => {
    setComponentFilter(val)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setDivisionFilter('')
    setCourseFilter('')
    setComponentFilter('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() || divisionFilter || courseFilter || componentFilter
  )

  const handleExportExcel = async () => {
    if (exporting || total === 0) return
    setExporting(true)
    try {
      const params: AbsentStudentsParams = {
        query: searchQuery.trim() || undefined,
        division: divisionFilter.trim() || undefined,
        course_code: courseFilter.trim() || undefined,
        component: componentFilter.trim() || undefined,
      }
      try {
        await downloadAbsentStudentsExcel(params)
      } catch (backendErr) {
        console.warn('Server-side absent xlsx export failed, falling back to client CSV export', backendErr)
        const fetchAll = await getAbsentStudents({ ...params, limit: 10000, offset: 0 })
        const dataset = fetchAll.items || []
        exportAbsentStudents(dataset, false)
      }
    } catch (err) {
      console.error('Failed to export absent student records to Excel:', err)
    } finally {
      setExporting(false)
    }
  }

  const handlePrintRoster = async () => {
    if (printing || total === 0) return
    setPrinting(true)
    try {
      const params: AbsentStudentsParams = {
        query: searchQuery.trim() || undefined,
        division: divisionFilter.trim() || undefined,
        course_code: courseFilter.trim() || undefined,
        component: componentFilter.trim() || undefined,
        limit: 10000,
        offset: 0,
      }
      const allRecords = await getAbsentStudents(params)
      setPrintRecords(allRecords.items || [])
      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 300)
    } catch (err) {
      console.error('Failed to load complete dataset for printing:', err)
      window.print()
      setPrinting(false)
    }
  }

  // Summary counts
  const distinctStudents = totalStudents || new Set(records.map((r) => r.student_id)).size
  const distinctCourses = totalCourses || new Set(records.map((r) => r.course_code)).size
  const recordsToPrint = printRecords && printRecords.length > 0 ? printRecords : records

  const columns: Column<AbsentStudentItem>[] = [
    {
      key: 'roll_no',
      header: 'Seat / Roll',
      width: '100px',
      sticky: true,
      render: (row) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
            {row.roll_no || row.seat_no || row.student_id}
          </span>
          {row.roll_no && row.seat_no && (
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Seat: {row.seat_no}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      minWidth: '140px',
      maxWidth: '220px',
      wrap: true,
      render: (row) => (
        <Link
          to={`/students/${encodeURIComponent(row.student_id)}`}
          style={{
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            display: 'inline-block',
            lineHeight: 1.3,
          }}
          className="hover-underline"
          title={row.name}
        >
          {toTitleCase(row.name)}
        </Link>
      ),
    },
    {
      key: 'division',
      header: 'Div',
      width: '50px',
      align: 'center',
      render: (row) => (
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
          }}
        >
          {row.division || '—'}
        </span>
      ),
    },
    {
      key: 'course_code',
      header: 'Subject',
      minWidth: '130px',
      maxWidth: '200px',
      wrap: true,
      render: (row) => (
        <div>
          <Link
            to={`/subjects/${encodeURIComponent(row.course_code)}`}
            style={{
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
            }}
            className="hover-underline"
          >
            {row.course_code}
          </Link>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.2,
              marginTop: '1px',
            }}
            title={row.course_name}
          >
            {row.course_name}
          </div>
        </div>
      ),
    },
    {
      key: 'component',
      header: 'Component',
      width: '90px',
      align: 'center',
      render: (row) => (
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-active)',
            color: 'var(--text)',
          }}
        >
          {row.component}
        </span>
      ),
    },
    {
      key: 'raw_text',
      header: 'Marker',
      width: '75px',
      align: 'center',
      render: (row) => (
        <span
          className="font-mono"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            border: '1px solid var(--status-warning-border)',
            letterSpacing: '0.04em',
          }}
        >
          {row.raw_text || 'AB'}
        </span>
      ),
    },
    {
      key: 'overall_result',
      header: 'Result',
      width: '100px',
      align: 'center',
      render: (row) => {
        const outcome = (row.overall_result || '').toUpperCase()
        const tone: 'pass' | 'fail' | 'warn' = outcome.includes('PASS')
          ? 'pass'
          : outcome.includes('FAIL')
          ? 'fail'
          : 'warn'
        return <StatusBadge tone={tone} size="sm" label={outcome || 'UNRESOLVED'} />
      },
    },
    {
      key: 'actions',
      header: '',
      width: '105px',
      align: 'right',
      render: (row) => (
        <Link
          to={`/students/${encodeURIComponent(row.student_id)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            transition: 'all var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>View</span>
          <ArrowUpRight size={12} />
        </Link>
      ),
    },
  ]

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
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

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-1)',
            }}
          >
            <UserX size={14} />
            <span>ABSENTEEISM AUDIT</span>
          </div>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Absent Students Audit
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              margin: 'var(--space-1) 0 0 0',
            }}
          >
            Authoritative log of students with recorded absent markers (A, AB, ABS, ABSENT) in examination components.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            loading={exporting}
            icon={<Download size={14} />}
            title="Export filtered absent records to Excel (.xlsx)"
          >
            Export to Excel (.xlsx)
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrintRoster}
            disabled={printing || total === 0}
            loading={printing}
            icon={<Printer size={14} />}
            title="Print complete absent students roster"
          >
            Print Roster
          </Button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      {total > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <AlertTriangle size={14} style={{ color: 'var(--status-warning-text)' }} />
              <span>Absence Incidents</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {total.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total unattempted evaluations
            </div>
          </GlassCard>

          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Users size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>Absent Students</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {distinctStudents}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Distinct students with absences
            </div>
          </GlassCard>

          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <BookOpen size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>Affected Courses</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {distinctCourses}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Courses with absent evaluations
            </div>
          </GlassCard>
        </div>
      )}

      {/* Filter Bar */}
      <GlassCard elevation={1} padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ flex: '1 1 280px', maxWidth: '380px' }}>
            <SearchField
              placeholder="Search by student name, roll no, seat no..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search absent students"
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            {/* Division Filter */}
            <div style={{ minWidth: '140px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Divisions' },
                  { value: 'A', label: 'Division A' },
                  { value: 'B', label: 'Division B' },
                ]}
                value={divisionFilter}
                onChange={handleDivisionChange}
                size="sm"
                ariaLabel="Filter by Division"
              />
            </div>

            {/* Course Filter */}
            <div style={{ minWidth: '180px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Subjects' },
                  ...availableCourses.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
                ]}
                value={courseFilter}
                onChange={handleCourseChange}
                size="sm"
                ariaLabel="Filter by Subject"
              />
            </div>

            {/* Component Filter */}
            <div style={{ minWidth: '160px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Components' },
                  ...availableComponents.map((comp) => ({ value: comp, label: comp })),
                ]}
                value={componentFilter}
                onChange={handleComponentChange}
                size="sm"
                ariaLabel="Filter by Component"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          error={error}
          title="Could not load absent student records"
          onRetry={fetchAbsentList}
        />
      )}

      {/* Main Table / Empty / Loading */}
      {loading && !records.length ? (
        <LoadingState message="Fetching absent records from database..." />
      ) : !loading && !records.length ? (
        <EmptyState
          title="No Absent Students Found"
          description={
            hasActiveFilters
              ? 'No absent records matched your specified filters. Try clearing your search or selecting different options.'
              : 'No student absence records (A, AB, ABS, ABSENT) were detected in the active marksheet dataset.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Reset All Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable<AbsentStudentItem>
          columns={columns}
          data={records}
          keyExtractor={(item, idx) => `${item.student_id}-${item.course_code}-${item.component}-${idx}`}
          isLoading={loading}
          showDensityToggle={true}
          defaultDensity="comfortable"
          showPagination={true}
          serverTotal={total}
          currentPage={page}
          onPageChange={setPage}
          pageSize={pageSize}
        />
      )}

      {/* Hidden Print Container for Clean Roster Printing */}
      {printRecords && printRecords.length > 0 && (
      <div className="print-absent-view">
        <div style={{ marginBottom: '14px', borderBottom: '2px solid #0f172a', paddingBottom: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '16pt', fontWeight: 800 }}>EduQuery &mdash; Absent Students Audit Roster</h1>
          <div style={{ fontSize: '9pt', color: '#475569', marginTop: '4px' }}>
            Generated on {new Date().toLocaleDateString()} | Total Incidents: {recordsToPrint.length}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Roll No</th>
              <th style={{ width: '12%' }}>Seat No</th>
              <th style={{ width: '22%' }}>Student Name</th>
              <th style={{ width: '6%' }}>Div</th>
              <th style={{ width: '12%' }}>Course Code</th>
              <th style={{ width: '20%' }}>Course Title</th>
              <th style={{ width: '8%' }}>Comp</th>
              <th style={{ width: '8%' }}>Marker</th>
            </tr>
          </thead>
          <tbody>
            {recordsToPrint.map((item, idx) => (
              <tr key={`print-${item.student_id}-${item.course_code}-${item.component}-${idx}`}>
                <td style={{ fontWeight: 600 }}>{item.roll_no || '—'}</td>
                <td>{item.seat_no || '—'}</td>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td style={{ textAlign: 'center' }}>{item.division || '—'}</td>
                <td style={{ fontWeight: 600 }}>{item.course_code}</td>
                <td>{item.course_name}</td>
                <td>{item.component}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.raw_text || 'AB'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

export default AbsentStudentsPage
