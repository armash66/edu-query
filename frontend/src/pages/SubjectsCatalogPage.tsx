import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  ArrowRight,
  TrendingDown,
  Layers,
} from 'lucide-react'
import {
  getSubjects,
  getSubjectFailureSummary,
  type SubjectListParams,
} from '../api/client'
import {
  ApiError,
  type CourseItem,
  type PaginatedResponse,
  type SubjectFailureSummaryItem,
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
  const electiveGroups = useMemo(() => {
    return [
      {
        id: 'mdm',
        name: 'Multidisciplinary Minor Electives (MDM Choices)',
        description: 'Cohort students selected exactly 1 of 4 multidisciplinary minor options (145 enrolled).',
        totalEnrolled: 145,
        courses: [
          { code: 'MDMBD02', name: 'Financial Basics for Engineers and Technopreneurs', enrolled: 63, kind: 'Theory', smallCohort: false },
          { code: 'MDMIE02', name: 'Startup Planning and Development', enrolled: 41, kind: 'Theory', smallCohort: false },
          { code: 'MDMRB02', name: 'Machine Vision and Robotic Perception', enrolled: 32, kind: 'Theory', smallCohort: false },
          { code: 'MDMBI02', name: 'Algorithms and Data Structures in Bioinformatics', enrolled: 9, kind: 'Theory', smallCohort: false },
        ],
      },
      {
        id: 'pe',
        name: 'Program Electives (Specialization Tracks)',
        description: 'Domain-specific program electives with associated practical laboratory units.',
        totalEnrolled: 145,
        courses: [
          { code: 'PEEC09T', name: 'Machine Learning (paired with PEEC09P)', enrolled: 116, kind: 'Theory', smallCohort: false },
          { code: 'PEEC05T', name: 'Soft Computing (paired with PEEC05P)', enrolled: 116, kind: 'Theory', smallCohort: false },
          { code: 'PEEC06T', name: 'Data Warehousing and Mining (paired with PEEC06P)', enrolled: 18, kind: 'Theory', smallCohort: false },
          { code: 'PEEC10T', name: 'Probabilistic Graphic Model (paired with PEEC10P)', enrolled: 18, kind: 'Theory', smallCohort: false },
          { code: 'PEEC08T', name: 'Advanced VLSI Design and Technology (paired with PEEC08P)', enrolled: 9, kind: 'Theory', smallCohort: false },
          { code: 'PEEC12T', name: 'Analog IC Design (paired with PEEC12P)', enrolled: 9, kind: 'Theory', smallCohort: false },
          { code: 'PEEC07T', name: 'Principles of IoT (paired with PEEC07P)', enrolled: 2, kind: 'Theory', smallCohort: true },
          { code: 'PEEC11T', name: 'Embedded System Design with Tiny OS (paired with PEEC11P)', enrolled: 2, kind: 'Theory', smallCohort: true },
        ],
      },
    ]
  }, [])

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
          <span>Academic Curriculum Roster</span>
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
          Curriculum Subjects & Failure Ranking
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Evaluate course outcomes, track failure rates across subjects, and audit elective distribution.
        </p>
      </div>

      {/* 2. Catalog Cards (Requirement 5) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Curriculum Courses
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            27 Courses
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            145 students enrolled class-wide
          </div>
        </GlassCard>

        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Class-Wide Pass Rate
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            91.0%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            132 of 145 students passed all courses
          </div>
        </GlassCard>

        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Highest Failure Subject
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--status-danger-text)', marginTop: '4px' }}>
            PCEC12T (12)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Theory of Computer Science · 8.3% failure rate
          </div>
        </GlassCard>

        <GlassCard variant="glass-1" padding="md">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Elective Offering Tracks
          </div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>
            2 Groups
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            MDM Electives & Program Electives
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div
            style={{
              padding: '10px 14px',
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
            <Layers size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--text)' }}>Elective Policy Audit:</strong> Discovered elective choices
              partition cohort enrollment across offerings. Small elective cohorts (under 5 students) are presented plainly
              without statistical modeling or curves.
            </div>
          </div>

          {electiveGroups.map((group) => (
            <GlassCard key={group.id} variant="glass-2" padding="lg">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    {group.name}
                  </h2>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {group.totalEnrolled} total enrolled candidates
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {group.description}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.courses.map((course) => (
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
                        {course.smallCohort && (
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
                            Small Cohort (&lt;5 students)
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
                          {course.enrolled}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          enrolled
                        </div>
                      </div>

                      <Link
                        to={`/subjects/${course.code.split(' ')[0]}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-active)',
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
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

export default SubjectsCatalogPage
