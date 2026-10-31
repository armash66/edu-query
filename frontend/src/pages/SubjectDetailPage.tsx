import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Download,
  ChevronDown,
  Printer,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import {
  getSubjectStudents,
  downloadSubjectStudentsExcel,
  downloadSubjectStudentsPdf,
  downloadSubjectStudentsCsv,
  saveBlobAsFile,
} from '../api/client'
import {
  ApiError,
  type SubjectStudentsResponse,
  type SubjectStudentItem,
  type ComponentScoreSchema,
} from '../api/types'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import { SearchField } from '../ui/SearchField'
import { DataTable, type Column } from '../ui/DataTable'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Skeleton } from '../ui/Skeleton'

export const SubjectDetailPage: React.FC = () => {
  const { courseCode } = useParams<{ courseCode: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const divisionParam = searchParams.get('division') || ''
  const rawStatus = (
    searchParams.get('status') ||
    searchParams.get('result') ||
    'all'
  ).toLowerCase()
  const statusParam = rawStatus as 'all' | 'passed' | 'failed' | 'absent' | 'toppers'
  const searchParam = searchParams.get('search') || ''
  const pageParam = parseInt(searchParams.get('page') || '1', 10)

  const [data, setData] = useState<SubjectStudentsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false)
  const [searchInput, setSearchInput] = useState<string>(searchParam)
  const [printing, setPrinting] = useState<boolean>(false)
  const [exportingPdf, setExportingPdf] = useState<boolean>(false)
  const [exportingExcel, setExportingExcel] = useState<boolean>(false)
  const [exportingCsv, setExportingCsv] = useState<boolean>(false)
  const [printAllStudents, setPrintAllStudents] = useState<SubjectStudentItem[] | null>(null)

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

  const handleStatusChange = (newStatus: 'all' | 'passed' | 'failed' | 'absent' | 'toppers') => {
    const nextParams = new URLSearchParams(searchParams)
    if (newStatus !== 'all') {
      nextParams.set('status', newStatus)
    } else {
      nextParams.delete('status')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const handleSearchSubmit = (val: string) => {
    setSearchInput(val)
    const nextParams = new URLSearchParams(searchParams)
    if (val.trim()) {
      nextParams.set('search', val.trim())
    } else {
      nextParams.delete('search')
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const visibleStudents = useMemo(() => {
    if (!data?.students) return []
    if (statusParam === 'all') return data.students
    if (statusParam === 'toppers') {
      return [...data.students]
        .sort((a, b) => (b.total_marks ?? 0) - (a.total_marks ?? 0))
        .slice(0, 5)
    }
    return data.students.filter((s) => {
      const st = (s.status || '').toLowerCase()
      if (statusParam === 'passed') return st === 'passed'
      if (statusParam === 'failed') return st === 'failed'
      if (statusParam === 'absent') return s.is_absent || st === 'absent'
      return true
    })
  }, [data?.students, statusParam])

  const handlePrintRoster = async () => {
    if (!courseCode) return
    try {
      setPrinting(true)
      if ((data?.total_enrolled ?? 0) > visibleStudents.length) {
        const fullRes = await getSubjectStudents(courseCode, {
          division: divisionParam.trim() || undefined,
          status: statusParam !== 'all' ? statusParam : undefined,
          result: statusParam !== 'all' ? statusParam : undefined,
          search: searchParam.trim() || undefined,
          limit: Math.min(Math.max(data?.total_enrolled ?? 200, 50), 500),
          offset: 0,
        })
        if (fullRes?.students && fullRes.students.length > 0) {
          setPrintAllStudents(fullRes.students)
          setTimeout(() => {
            window.print()
            setPrinting(false)
            setPrintAllStudents(null)
          }, 200)
          return
        }
      }
      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 150)
    } catch {
      window.print()
      setPrinting(false)
    }
  }

  const handleExportPdf = async (type: 'all' | 'passed' | 'failed' | 'absent' = 'all') => {
    if (!courseCode) return
    try {
      setExportingPdf(true)
      const blob = await downloadSubjectStudentsPdf(
        courseCode,
        type,
        divisionParam.trim() || null
      )
      saveBlobAsFile(blob, `EduQuery_${courseCode}_${type}_Roster.pdf`)
    } catch {
      alert(`Failed to download ${type} subject roster PDF. Please try again.`)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportCsv = async (type: 'all' | 'passed' | 'failed' | 'absent' = 'all') => {
    if (!courseCode) return
    try {
      setExportingCsv(true)
      const blob = await downloadSubjectStudentsCsv(
        courseCode,
        type,
        divisionParam.trim() || null
      )
      saveBlobAsFile(blob, `EduQuery_${courseCode}_${type}_Roster.csv`)
    } catch {
      alert(`Failed to download ${type} subject roster CSV. Please try again.`)
    } finally {
      setExportingCsv(false)
    }
  }

  const handleExportExcel = async (type: 'all' | 'passed' | 'failed' | 'absent' = 'all') => {
    if (!courseCode) return
    try {
      setExportingExcel(true)
      const blob = await downloadSubjectStudentsExcel(
        courseCode,
        type,
        divisionParam.trim() || null
      )
      saveBlobAsFile(blob, `EduQuery_${courseCode}_${type}.xlsx`)
    } catch {
      alert(`Failed to download ${type} students Excel workbook. Please try again.`)
    } finally {
      setExportingExcel(false)
    }
  }

  const columns: Column<SubjectStudentItem>[] = [
    {
      key: 'seat_no',
      header: 'Seat No',
      sticky: true,
      sortable: true,
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 600 }}>
          {row.seat_no || '—'}
        </span>
      ),
    },
    {
      key: 'roll_no',
      header: 'Roll No',
      sortable: true,
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ color: 'var(--text-secondary)' }}>
          {row.roll_no || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      sortable: true,
      render: (row) => (
        <Link
          to={`/students/${row.student_id}`}
          style={{
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'division',
      header: 'Div',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
          }}
        >
          {row.division || '—'}
        </span>
      ),
    },
    {
      key: 'components',
      header: 'Component Marks',
      render: (row) => {
        const entries = Object.entries(row.components || {})
        if (entries.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>

        return (
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            {entries.map(([cName, sc]: [string, ComponentScoreSchema]) => (
              <span
                key={cName}
                style={{
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                }}
              >
                {cName}:{' '}
                <strong className="font-mono tabular-nums">
                  {sc.marks !== null ? sc.marks : sc.raw_text || '—'}
                </strong>
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'total_marks',
      header: 'Total Marks',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ fontWeight: 700 }}>
          {row.total_marks ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (row) => {
        const isPassed = (row.status || '').toLowerCase() === 'passed'
        const isFailed = (row.status || '').toLowerCase() === 'failed'

        return (
          <StatusBadge
            tone={isPassed ? 'pass' : isFailed ? 'fail' : 'warn'}
            size="sm"
            label={row.status || 'Pending'}
          />
        )
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <Skeleton height="36px" width="200px" style={{ marginBottom: 'var(--space-4)' }} />
        <Skeleton height="140px" radius="var(--radius-card)" style={{ marginBottom: 'var(--space-6)' }} />
        <Skeleton height="320px" radius="var(--radius-card)" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 var(--space-4)' }}>
        <ErrorState
          title="Could not load subject roster"
          message={error?.message || 'Database error retrieving course roster.'}
          onRetry={fetchCourseStudents}
        />
      </div>
    )
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
      {/* Back Link */}
      <div className="no-print">
        <Link
          to="/subjects"
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
          <span>Back to Course Catalog</span>
        </Link>
      </div>

      {/* Course Details Header Card */}
      <GlassCard variant="glass-2" padding="lg" className="subject-header-card">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <span className="font-mono" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-hover)', color: 'var(--text)' }}>
                {data.course_code}
              </span>
              {data.kind && (
                <span style={{ fontSize: 'var(--text-xs)', textTransform: 'capitalize', padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                  {data.kind}
                </span>
              )}
              {data.credits != null && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {data.credits} Credits
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)', margin: '0 0 var(--space-1) 0' }}>
              {data.course_name}
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Unified student evaluation roster showing passed, failed, and absent candidates
            </p>
          </div>

          {/* Action Buttons: Print Roster & Export Menu */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', position: 'relative' }}>
            <Button
              size="sm"
              variant="secondary"
              loading={printing}
              onClick={handlePrintRoster}
              icon={<Printer size={14} />}
            >
              Print Roster
            </Button>

            <div style={{ position: 'relative' }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                icon={<Download size={14} />}
                iconPosition="left"
                aria-label="Export Course Roster Menu"
              >
                <span>Export</span>
                <ChevronDown size={14} style={{ marginLeft: '4px', transform: exportMenuOpen ? 'rotate(180deg)' : 'none' }} />
              </Button>

              {exportMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div
                    className="glass-3"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 4px)',
                      borderRadius: 'var(--radius-sm)',
                      minWidth: '240px',
                      zIndex: 101,
                      padding: 'var(--space-1)',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Export {data.course_code} Rosters
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false)
                        handlePrintRoster()
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <Printer size={14} />
                      <span>Print Marksheet</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingPdf}
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportPdf('all')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text)',
                        cursor: exportingPdf ? 'wait' : 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <FileText size={14} />
                      <span>Download Result Slip (.pdf)</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingExcel}
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportExcel('all')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text)',
                        cursor: exportingExcel ? 'wait' : 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Export Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingCsv}
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportCsv('all')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text)',
                        cursor: exportingCsv ? 'wait' : 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <Download size={14} />
                      <span>Export CSV (.csv)</span>
                    </button>

                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3) var(--space-1)',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        borderTop: '1px solid var(--border)',
                        marginTop: '4px',
                      }}
                    >
                      Filtered Downloads
                    </div>

                    <button
                      type="button"
                      disabled={data.passed_count === 0}
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportExcel('passed')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--status-success-text)',
                        cursor: data.passed_count === 0 ? 'not-allowed' : 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <CheckCircle size={14} />
                      <span>Passed Students ({data.passed_count})</span>
                    </button>

                    <button
                      type="button"
                      disabled={data.failed_count === 0}
                      onClick={() => {
                        setExportMenuOpen(false)
                        handleExportExcel('failed')
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--status-danger-text)',
                        cursor: data.failed_count === 0 ? 'not-allowed' : 'pointer',
                        borderRadius: 'var(--radius-xs)',
                        textAlign: 'left',
                      }}
                    >
                      <AlertTriangle size={14} />
                      <span>Failed Students ({data.failed_count})</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Ribbon */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginTop: 'var(--space-4)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div>
              Total Enrolled: <strong className="tabular-nums font-mono">{data.total_enrolled}</strong>
            </div>
            <div style={{ color: 'var(--status-success-text)' }}>
              Passed: <strong className="tabular-nums font-mono">{data.passed_count}</strong>
            </div>
            <div style={{ color: 'var(--status-danger-text)' }}>
              Failed: <strong className="tabular-nums font-mono">{data.failed_count}</strong>
            </div>
            {(data.absent_count ?? 0) > 0 && (
              <div style={{ color: 'var(--status-warning-text)' }}>
                Absent: <strong className="tabular-nums font-mono">{data.absent_count}</strong>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              className="tabular-nums font-mono"
              style={{
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
                color: data.pass_percentage >= 50 ? 'var(--status-success-text)' : 'var(--status-danger-text)',
              }}
            >
              Pass Rate: {data.pass_percentage.toFixed(1)}%
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {data.denominator_explanation || 'Pass rate calculated as Passed / (Passed + Failed)'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Filter and Search Bar */}
      <GlassCard variant="glass-1" padding="sm" className="no-print">
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
              placeholder="Search by student name, roll no, or seat no..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onClear={() => handleSearchSubmit('')}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant={statusParam === 'all' ? 'primary' : 'secondary'}
              onClick={() => handleStatusChange('all')}
            >
              All ({data.total_enrolled})
            </Button>
            <Button
              size="sm"
              variant={statusParam === 'passed' ? 'primary' : 'secondary'}
              onClick={() => handleStatusChange('passed')}
            >
              Passed ({data.passed_count})
            </Button>
            <Button
              size="sm"
              variant={statusParam === 'failed' ? 'primary' : 'secondary'}
              onClick={() => handleStatusChange('failed')}
            >
              Failed ({data.failed_count})
            </Button>
            {(data.absent_count ?? 0) > 0 && (
              <Button
                size="sm"
                variant={statusParam === 'absent' ? 'primary' : 'secondary'}
                onClick={() => handleStatusChange('absent')}
              >
                Absent ({data.absent_count})
              </Button>
            )}
            <Button
              size="sm"
              variant={statusParam === 'toppers' ? 'primary' : 'secondary'}
              onClick={() => handleStatusChange('toppers')}
            >
              Toppers (Top 5)
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Student List Table */}
      {visibleStudents.length === 0 ? (
        <EmptyState
          title="No Students in Roster"
          description="There are no student records matching the selected status or query."
        />
      ) : (
        <DataTable
          columns={columns}
          data={printAllStudents || visibleStudents}
          keyExtractor={(row) => row.student_id}
          pageSize={printAllStudents ? 500 : pageSize}
          showDensityToggle
          showPagination={!printAllStudents}
          defaultDensity="comfortable"
        />
      )}
    </div>
  )
}

export default SubjectDetailPage
