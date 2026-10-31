import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  ArrowRight,
  TrendingDown,
  Layers,
  Info,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import {
  getSubjects,
  getSubjectFailureSummary,
  getOverviewSummary,
  type SubjectListParams,
} from '../api/client'
import {
  ApiError,
  type CourseItem,
  type PaginatedResponse,
  type SubjectFailureSummaryItem,
  type OverviewSummaryResponse,
} from '../api/types'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/Tabs'
import { DataTable, type Column } from '../ui/DataTable'
import { FailureRateBar } from '../ui/FailureRateBar'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Listbox } from '../ui/Listbox'

export const SubjectsCatalogPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam === 'failures' ? 'failures' : tabParam === 'electives' ? 'electives' : 'catalog'
  const { session } = useSession()

  const [courses, setCourses] = useState<CourseItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const [kindFilter, setKindFilter] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Failures Ranking Data
  const [failuresSummary, setFailuresSummary] = useState<SubjectFailureSummaryItem[]>([])
  const [failuresLoading, setFailuresLoading] = useState<boolean>(false)

  const [overviewSummary, setOverviewSummary] = useState<OverviewSummaryResponse | null>(null)


  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params: SubjectListParams = {
      kind: kindFilter.trim() || undefined,
      division: divisionFilter.trim() || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    try {
      const data: PaginatedResponse<CourseItem> = await getSubjects(params)
      setCourses(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve course catalog'))
      }
    } finally {
      setLoading(false)
    }
  }, [kindFilter, divisionFilter, page, pageSize])

  const fetchFailures = useCallback(async () => {
    setFailuresLoading(true)
    try {
      const res = await getSubjectFailureSummary(divisionFilter || undefined)
      setFailuresSummary(res.summary || [])
    } catch {
      // Handled in tab
    } finally {
      setFailuresLoading(false)
    }
  }, [divisionFilter])


  useEffect(() => {
    getOverviewSummary()
      .then(setOverviewSummary)
      .catch(() => {})
    fetchFailures()
  }, [session?.session_id, fetchFailures])

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalog()
    } else if (activeTab === 'failures') {
      fetchFailures()
    } else if (activeTab === 'electives') {
      fetchCatalog()
    }
  }, [activeTab, fetchCatalog, fetchFailures])

  const handleTabChange = (tabId: string) => {
    if (tabId === 'failures') {
      setSearchParams({ tab: 'failures' })
    } else if (tabId === 'electives') {
      setSearchParams({ tab: 'electives' })
    } else {
      setSearchParams({})
    }
  }

  // Discovered Elective Groups: MDM electives (145 enrolled total) and Program electives (145 enrolled total)

  const electiveCourses = useMemo(() => {
    return courses.filter((c) => {
      const k = (c.kind || '').toLowerCase()
      const n = (c.name || '').toLowerCase()
      const code = (c.code || '').toUpperCase()
      return k.includes('elective') || n.includes('elective') || code.startsWith('MDM') || code.startsWith('PE') || code.startsWith('OE')
    })
  }, [courses])

  const columns: Column<CourseItem>[] = [
    {
      key: 'code',
      header: 'Course Code',
      width: '95px',
      sticky: true,
      sortable: true,
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 700 }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Course Title',
      minWidth: '180px',
      maxWidth: '300px',
      wrap: true,
      sortable: true,
      render: (row) => (
        <div style={{ maxWidth: '290px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{row.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>
            {(row.components || []).join(' • ') || 'No components defined'}
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Modality',
      width: '80px',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'capitalize',
            padding: '2px 8px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
            fontWeight: 500,
          }}
        >
          {row.kind || 'Theory'}
        </span>
      ),
    },
    {
      key: 'credits',
      header: 'Credits',
      width: '65px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
          {row.credits ?? '—'}
        </span>
      ),
    },
    {
      key: 'enrolled_students_count',
      header: 'Headcount',
      width: '80px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono">
          {row.enrolled_students_count ?? '—'}
        </span>
      ),
    },
    {
      key: 'passed_students_count',
      header: 'Passed',
      width: '75px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ fontWeight: 600, color: 'var(--text)' }}>
          {row.passed_students_count !== null && row.passed_students_count !== undefined
            ? row.passed_students_count
            : '—'}
        </span>
      ),
    },
    {
      key: 'failed_students_count',
      header: 'Failed',
      width: '75px',
      sortable: true,
      align: 'right',
      render: (row) => {
        const count = row.failed_students_count ?? 0
        const totalEnrolled = row.enrolled_students_count || 0
        const rate = totalEnrolled > 0 ? (count / totalEnrolled) * 100 : 0
        if (count === 0) {
          return (
            <span className="tabular-nums font-mono" style={{ color: 'var(--text-muted)' }}>
              0
            </span>
          )
        }
        return (
          <span
            className="tabular-nums font-mono"
            style={{
              fontWeight: 600,
              color:
                rate > 15
                  ? 'var(--status-danger-text)'
                  : rate > 5
                  ? 'var(--status-warning-text)'
                  : 'var(--text)',
            }}
          >
            {count}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: '145px',
      align: 'right',
      render: (row) => (
        <Link
          to={`/subjects/${row.code}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>View Roster</span>
          <ArrowRight size={12} />
        </Link>
      ),
    },
  ]

  const failureColumns: Column<SubjectFailureSummaryItem>[] = [
    {
      key: 'course_code',
      header: 'Course Code',
      width: '100px',
      sticky: true,
      sortable: true,
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 700 }}>
          {row.course_code}
        </span>
      ),
    },
    {
      key: 'course_name',
      header: 'Course Title',
      minWidth: '200px',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.course_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.kind || 'Theory'} &bull; {row.credits ?? '—'} Credits
          </div>
        </div>
      ),
    },
    {
      key: 'total_enrolled',
      header: 'Enrolled',
      width: '80px',
      align: 'right',
      sortable: true,
      render: (row) => <span className="tabular-nums font-mono">{row.total_enrolled}</span>,
    },
    {
      key: 'confirmed_failures_count',
      header: 'Failed',
      width: '80px',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span
          className="tabular-nums font-mono"
          style={{
            fontWeight: 700,
            color: row.confirmed_failures_count > 0 ? 'var(--status-danger-text)' : 'var(--text-muted)',
          }}
        >
          {row.confirmed_failures_count}
        </span>
      ),
    },
    {
      key: 'failure_rate_percent',
      header: 'Failure Rate',
      minWidth: '180px',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <FailureRateBar
              subjectCode={row.course_code}
              subjectName={row.course_name}
              failureRate={row.failure_rate_percent}
              failedStudents={row.confirmed_failures_count}
              totalStudents={row.total_enrolled}
            />
          </div>
          <span className="tabular-nums font-mono" style={{ fontSize: '11px', minWidth: '45px', textAlign: 'right' }}>
            {row.failure_rate_percent.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '145px',
      align: 'right',
      render: (row) => (
        <Link
          to={`/subjects/${row.course_code}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>View Roster</span>
          <ArrowRight size={12} />
        </Link>
      ),
    },
  ]

  const modalityOptions = [
    { value: '', label: 'All Modalities' },
    { value: 'theory', label: 'Theory' },
    { value: 'practical', label: 'Practical' },
  ]

  const divisionOptions = [
    { value: '', label: 'All Divisions' },
    { value: 'A', label: 'Division A' },
    { value: 'B', label: 'Division B' },
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
        padding: '0 var(--space-4) var(--space-12)',
      }}
    >
      {/* 1. Header */}
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
          <BookOpen size={14} />
          <span>Curriculum</span>
        </div>
        <h1
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Subjects & Courses
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Overview of courses, enrollment counts, pass rates, and failures.
        </p>
      </div>

      {/* 2. Catalog Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: Total Courses */}
        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Courses
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            {total || courses.length || overviewSummary?.kpis?.total_courses || 0} Courses
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {session?.students_count || overviewSummary?.kpis?.total_students
              ? `${session?.students_count || overviewSummary?.kpis?.total_students} students enrolled`
              : 'Enrolled students'}
          </div>
        </GlassCard>

        {/* Card 2: Pass Rate */}
        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Pass Rate
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            {overviewSummary?.kpis?.pass_rate_percent !== undefined ? `${overviewSummary.kpis.pass_rate_percent.toFixed(1)}%` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {overviewSummary?.kpis ? `${overviewSummary.kpis.passed_students} of ${overviewSummary.kpis.total_students} students passed all subjects` : 'Pass rate'}
          </div>
        </GlassCard>

        {/* Card 3: Highest Failure Subject */}
        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Most Failed Subject
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--status-danger-text)', marginTop: '4px' }}>
            {failuresSummary.length > 0 && failuresSummary[0].confirmed_failures_count > 0
              ? `${failuresSummary[0].course_code} (${failuresSummary[0].confirmed_failures_count})`
              : overviewSummary?.hardest_subjects?.[0] && overviewSummary.hardest_subjects[0].failed_count > 0
              ? `${overviewSummary.hardest_subjects[0].course_code} (${overviewSummary.hardest_subjects[0].failed_count})`
              : 'None'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {failuresSummary.length > 0 && failuresSummary[0].confirmed_failures_count > 0
              ? `${failuresSummary[0].course_name} · ${failuresSummary[0].failure_rate_percent.toFixed(1)}% failed`
              : overviewSummary?.hardest_subjects?.[0] && overviewSummary.hardest_subjects[0].failed_count > 0
              ? `${overviewSummary.hardest_subjects[0].course_title} · ${overviewSummary.hardest_subjects[0].failure_rate_percent.toFixed(1)}% failed`
              : 'No subject failures'}
          </div>
        </GlassCard>

        {/* Card 4: Electives */}
        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Elective Courses
          </div>
          <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            {electiveCourses.length > 0 ? `${electiveCourses.length} Elective${electiveCourses.length === 1 ? '' : 's'}` : 'Core Curriculum'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {electiveCourses.length > 0
              ? `${electiveCourses.length} elective courses found`
              : 'All courses are required'}
          </div>
        </GlassCard>
      </div>

      {/* 3. Tabs: Catalog | Failure Ranking | Electives */}
      <Tabs
        items={[
          { id: 'catalog', label: 'Course Catalog', icon: <BookOpen size={14} /> },
          { id: 'failures', label: 'Failure Ranking', icon: <TrendingDown size={14} /> },
          { id: 'electives', label: 'Electives Breakdown', icon: <Layers size={14} /> },
        ]}
        activeId={activeTab}
        onChange={handleTabChange}
      />

      {/* TAB 1: CATALOG */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Filters Bar */}
          <GlassCard variant="glass-1" padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '160px' }}>
                <Listbox
                  options={modalityOptions}
                  value={kindFilter}
                  onChange={(val) => {
                    setKindFilter(val)
                    setPage(1)
                  }}
                  size="sm"
                  ariaLabel="Filter by modality"
                />
              </div>

              <div style={{ minWidth: '160px' }}>
                <Listbox
                  options={divisionOptions}
                  value={divisionFilter}
                  onChange={(val) => {
                    setDivisionFilter(val)
                    setPage(1)
                  }}
                  size="sm"
                  ariaLabel="Filter by division"
                />
              </div>
            </div>
          </GlassCard>

          {/* Table */}
          {loading ? (
            <GlassCard variant="glass-2" padding="xl" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Loading curriculum catalog...
              </span>
            </GlassCard>
          ) : error ? (
            <ErrorState
              title="Could not load course catalog"
              message={error.message || 'Database query error'}
              onRetry={fetchCatalog}
              retryLabel="Retry"
            />
          ) : courses.length === 0 ? (
            <EmptyState
              title="No Courses Found"
              description="There are no course records matching your current filter criteria."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setKindFilter('')
                    setDivisionFilter('')
                    setPage(1)
                  }}
                >
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={courses}
              keyExtractor={(row) => row.code}
              pageSize={pageSize}
              serverTotal={total}
              currentPage={page}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
              pageSizeOptions={[25, 50, 100]}
              showDensityToggle
              defaultDensity="comfortable"
              onRowClick={(row) => navigate(`/subjects/${row.code}`)}
            />
          )}
        </div>
      )}

      {/* TAB 2: FAILURE RANKING */}
      {activeTab === 'failures' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <GlassCard variant="glass-1" padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div style={{ minWidth: '160px' }}>
                <Listbox
                  options={divisionOptions}
                  value={divisionFilter}
                  onChange={(val) => setDivisionFilter(val)}
                  size="sm"
                  ariaLabel="Filter by division"
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Sorted by confirmed failures descending
              </span>
            </div>
          </GlassCard>

          {failuresLoading ? (
            <GlassCard variant="glass-2" padding="xl" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Ranking subjects by failure rate...
              </span>
            </GlassCard>
          ) : (
            <DataTable
              columns={failureColumns}
              data={failuresSummary}
              keyExtractor={(row) => row.course_code}
              pageSize={25}
              showDensityToggle
              defaultDensity="comfortable"
              onRowClick={(row) => navigate(`/subjects/${row.course_code}`)}
            />
          )}
        </div>
      )}

      {/* TAB 3: ELECTIVES (Requirement 5) */}
      {activeTab === 'electives' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
              <strong style={{ color: 'var(--text)' }}>Elective Policy Audit:</strong> Discovered elective choices
              partition division enrollment across offerings. Small elective groups (under 5 students) are presented plainly
              without statistical modeling or curves.
            </div>
          </div>

          {electiveCourses.length === 0 ? (
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                No elective course tracks detected in this dataset. All registered courses are part of the core student curriculum.
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
                  Detected Elective Subjects ({electiveCourses.length})
                </h2>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Enrolled student headcounts and course outcomes across elective options
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {electiveCourses.map((course) => {
                  const enrolled = course.enrolled_students_count ?? 0
                  const isSmall = enrolled > 0 && enrolled < 5
                  return (
                    <div
                      key={course.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-hover)',
                        border: '1px solid var(--border)',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="font-mono" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
                            {course.code}
                          </span>
                          {isSmall && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--surface-active)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              Small Elective Group (&lt;5 students)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text)', marginTop: '2px', fontWeight: 500 }}>
                          {course.name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="tabular-nums font-mono" style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
                            {enrolled}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            enrolled
                          </div>
                        </div>

                        <Link
                          to={`/subjects/${encodeURIComponent(course.code.split(' ')[0])}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            color: 'var(--text)',
                            textDecoration: 'none',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--surface-active)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          View Roster &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  )
}

export default SubjectsCatalogPage
