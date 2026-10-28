import React, { useEffect, useState, useCallback } from 'react'
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
import { Skeleton } from '../ui/Skeleton'

export const SubjectsCatalogPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'failures' ? 'failures' : 'catalog'

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
    } else {
      fetchFailures()
    }
  }, [activeTab, fetchCatalog, fetchFailures])

  const handleTabChange = (tabId: string) => {
    setSearchParams(tabId === 'failures' ? { tab: 'failures' } : {})
  }

  const columns: Column<CourseItem>[] = [
    {
      key: 'code',
      header: 'Course Code',
      width: '120px',
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
      width: '260px',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {(row.components || []).join(' • ') || 'No components defined'}
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Modality',
      width: '100px',
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
      width: '85px',
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
      width: '105px',
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
      width: '95px',
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
      width: '95px',
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
      width: '140px',
      align: 'right',
      render: (row) => (
        <Link
          to={`/subjects/${row.code}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            transition: 'all var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>View Roster</span>
          <ArrowRight size={13} />
        </Link>
      ),
    },
  ]

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
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
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: '2px',
            }}
          >
            <BookOpen size={14} />
            <span>Academic Curriculum</span>
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
            Academic Course Catalog
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Ingested course catalog with curriculum components, credits, and enrollment headcounts.
            Click <strong>View Roster &amp; Export</strong> on any course to access its subject-wise
            Pass/Fail Excel export menu.
          </p>
        </div>

        {/* Tab switcher */}
        <div>
          <Tabs
            activeId={activeTab}
            onChange={handleTabChange}
            items={[
              { id: 'catalog', label: 'All Courses', icon: <Layers size={14} /> },
              { id: 'failures', label: 'Failure Rankings', icon: <TrendingDown size={14} /> },
            ]}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <GlassCard variant="glass-1" padding="sm">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {activeTab === 'catalog' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '150px' }}>
                <Listbox
                  options={[
                    { value: '', label: 'All Modalities' },
                    { value: 'theory', label: 'Theory' },
                    { value: 'practical', label: 'Practical' },
                  ]}
                  value={kindFilter}
                  onChange={(val) => {
                    setKindFilter(val)
                    setPage(1)
                  }}
                  size="sm"
                  ariaLabel="Filter by Modality"
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '150px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Divisions' },
                  { value: 'A', label: 'Division A' },
                  { value: 'B', label: 'Division B' },
                  { value: 'C', label: 'Division C' },
                  { value: 'D', label: 'Division D' },
                ]}
                value={divisionFilter}
                onChange={(val) => {
                  setDivisionFilter(val)
                  setPage(1)
                }}
                size="sm"
                ariaLabel="Filter by Division"
              />
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {activeTab === 'catalog' ? `${total} Courses Enrolled` : `${failuresSummary.length} Courses Ranked`}
          </div>
        </div>
      </GlassCard>

      {/* Tab Content */}
      {activeTab === 'catalog' ? (
        loading ? (
          <GlassCard variant="glass-2" padding="xl" style={{ textAlign: 'center' }}>
            <Skeleton height="320px" radius="var(--radius-card)" />
          </GlassCard>
        ) : error ? (
          <ErrorState
            title="Could not load course catalog"
            message={error.message || 'Database error loading courses.'}
            onRetry={fetchCatalog}
          />
        ) : courses.length === 0 ? (
          <EmptyState
            title="No Courses Found"
            description="There are no courses matching your modality or division filter."
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setKindFilter('')
                  setDivisionFilter('')
                }}
              >
                Reset Filters
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
        )
      ) : (
        /* Failures Ranking Tab */
        failuresLoading ? (
          <GlassCard variant="glass-2" padding="xl">
            <Skeleton height="320px" radius="var(--radius-card)" />
          </GlassCard>
        ) : failuresSummary.length === 0 ? (
          <EmptyState
            title="No Failure Records"
            description="All students have cleared their enrolled subjects without active backlogs."
          />
        ) : (
          <GlassCard variant="glass-2" padding="lg">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {failuresSummary.map((sub) => (
                <FailureRateBar
                  key={sub.course_code}
                  subjectCode={sub.course_code}
                  subjectName={sub.course_name}
                  failureRate={sub.failure_rate_percent}
                  failedStudents={sub.confirmed_failures_count}
                  totalStudents={sub.total_enrolled}
                  onClick={() => navigate(`/subjects/${sub.course_code}`)}
                />
              ))}
            </div>
          </GlassCard>
        )
      )}
    </div>
  )
}

export default SubjectsCatalogPage
