import { Listbox } from '../ui/Listbox'
import { toTitleCase } from '../utils/text'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Filter,
  ArrowRight,
  TrendingDown,
  BookOpen,
  ArrowUpDown,
  CheckCircle,
} from 'lucide-react'
import { getSubjectFailureSummary } from '../api/client'
import { ApiError, type SubjectFailureSummaryItem, type SubjectFailureSummaryResponse } from '../api/types'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'

type SortField = 'failure_rate' | 'failures_count' | 'enrolled' | 'course_name'
type SortOrder = 'asc' | 'desc'

export const SubjectFailuresPage: React.FC = () => {
  const [data, setData] = useState<SubjectFailureSummaryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('failures_count')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getSubjectFailureSummary(divisionFilter.trim() || undefined)
      setData(res)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve subject failure summary'))
      }
    } finally {
      setLoading(false)
    }
  }, [divisionFilter])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Sorted items
  const sortedItems = useMemo(() => {
    if (!data?.summary) return []
    const items = [...data.summary]
    items.sort((a, b) => {
      let comp = 0
      if (sortField === 'failure_rate') {
        comp = a.failure_rate_percent - b.failure_rate_percent
      } else if (sortField === 'failures_count') {
        comp = a.confirmed_failures_count - b.confirmed_failures_count
      } else if (sortField === 'enrolled') {
        comp = a.total_enrolled - b.total_enrolled
      } else if (sortField === 'course_name') {
        comp = a.course_name.localeCompare(b.course_name)
      }
      return sortOrder === 'desc' ? -comp : comp
    })
    return items
  }, [data?.summary, sortField, sortOrder])

  // Aggregate totals
  const totalFailures = useMemo(() => {
    return data?.summary.reduce((sum, item) => sum + item.confirmed_failures_count, 0) ?? 0
  }, [data?.summary])

  const totalEnrolledAcrossSubjects = useMemo(() => {
    return data?.summary.reduce((sum, item) => sum + item.total_enrolled, 0) ?? 0
  }, [data?.summary])

  return (
    <div>
      {/* Header and Controls Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={20} style={{ color: '#ef4444' }} />
                Subject Failure Analysis
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Inspect curriculum failure rates across all subjects. Drill down into specific courses to inspect failing students.
              </div>
            </div>

            {/* Division Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '160px' }}>
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
                onChange={(val) => setDivisionFilter(val)}
                size="sm"
                ariaLabel="Filter courses by division"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Overview Metrics */}
      {data && (
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Courses Evaluated
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {data.total_courses_evaluated}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {divisionFilter ? `Filtered for Division ${divisionFilter}` : 'Across all divisions'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Subject Failures
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444', marginTop: '0.2rem' }}>
                {totalFailures.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Cumulative course-level failure instances
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Course Enrollments
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {totalEnrolledAcrossSubjects.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Verified student-subject pairings
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error or Loading */}
      {error && <ErrorBanner error={error} title="Could not load failure summary" onRetry={fetchSummary} />}

      {loading && !data ? (
        <LoadingState message="Calculating curriculum failure rates and aggregating enrollments..." />
      ) : !loading && (!data?.summary || data.summary.length === 0) ? (
        <EmptyState
          icon={<BookOpen size={44} />}
          title="No Course Data Available"
          message={
            divisionFilter
              ? `No course data found for Division ${divisionFilter}.`
              : "No courses or marks are loaded in the current dataset."
          }
          action={
            divisionFilter ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDivisionFilter('')}>
                Clear Division Filter
              </button>
            ) : (
              <Link to="/imports" className="btn btn-primary btn-sm">
                Import Marksheet
              </Link>
            )
          }
        />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('course_name')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>Course Code & Title</span>
                      <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th>Kind / Credits</th>
                  <th onClick={() => handleSort('enrolled')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <span>Enrolled</span>
                      <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th style={{ textAlign: 'right' }}>Passed</th>
                  <th style={{ textAlign: 'right' }}>Unresolved</th>
                  <th onClick={() => handleSort('failures_count')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <span>Confirmed Failures</span>
                      <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('failure_rate')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                      <span>Failure Rate</span>
                      <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item: SubjectFailureSummaryItem) => {
                  const hasFailures = item.confirmed_failures_count > 0
                  return (
                    <tr key={item.course_code}>
                      <td>
                        <Link
                          to={`/subjects/${encodeURIComponent(item.course_code)}/failures${divisionFilter ? `?division=${encodeURIComponent(divisionFilter)}` : ''}`}
                          style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'none' }}
                          className="hover-underline"
                        >
                          {item.course_name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {item.course_code}
                        </div>
                      </td>
                      <td>
                        <div style={{ textTransform: 'capitalize' }}>{item.kind || '—'}</div>
                        {item.credits != null && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.credits} Credits
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.total_enrolled}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text)' }}>{item.passed_count}</td>
                      <td style={{ textAlign: 'right', color: item.unresolved_count > 0 ? 'var(--status-warning-text)' : 'var(--text-muted)' }}>{item.unresolved_count}</td>
                      <td style={{ textAlign: 'right' }}>
                        {hasFailures ? (
                          <span className="badge badge-danger" style={{ fontWeight: 700 }}>
                            {item.confirmed_failures_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            0
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                item.failure_rate_percent > 15
                                  ? 'var(--status-danger-text)'
                                  : item.failure_rate_percent >= 5
                                  ? 'var(--status-warning-text)'
                                  : 'var(--text)',
                            }}
                          >
                            {item.failure_rate_percent.toFixed(1)}%
                          </span>
                          <div
                            style={{
                              width: '45px',
                              height: '6px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(item.failure_rate_percent, 100)}%`,
                                height: '100%',
                                backgroundColor:
                                  item.failure_rate_percent > 15
                                    ? 'var(--status-danger-text)'
                                    : item.failure_rate_percent >= 5
                                    ? 'var(--status-warning-text)'
                                    : 'var(--neutral-500)',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/subjects/${encodeURIComponent(item.course_code)}/failures${divisionFilter ? `?division=${encodeURIComponent(divisionFilter)}` : ''}`}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <span>Roster</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
