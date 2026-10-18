import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Filter, ArrowRight, TrendingDown } from 'lucide-react'
import { getSubjects, type SubjectListParams } from '../api/client'
import { ApiError, type CourseItem, type PaginatedResponse } from '../api/types'
import { Pagination } from '../components/Pagination'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'

export const SubjectsCatalogPage: React.FC = () => {
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const [kindFilter, setKindFilter] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 25

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
  }, [kindFilter, divisionFilter, page])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  return (
    <div>
      {/* Header and Filter Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                Academic Course Catalog
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ingested course catalog with curriculum components, credits, and verified enrollment headcounts.
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="form-control"
                  style={{ width: '140px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  value={kindFilter}
                  onChange={(e) => {
                    setKindFilter(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by Modality"
                >
                  <option value="">All Modalities</option>
                  <option value="theory">Theory</option>
                  <option value="practical">Practical</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <select
                  className="form-control"
                  style={{ width: '140px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  value={divisionFilter}
                  onChange={(e) => {
                    setDivisionFilter(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by Division"
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
        </div>
      </div>

      {error && <ErrorBanner error={error} title="Could not load course catalog" onRetry={fetchCatalog} />}

      {loading && !courses.length ? (
        <LoadingState message="Fetching academic course catalog..." />
      ) : !loading && !courses.length ? (
        <EmptyState
          icon={<BookOpen size={44} />}
          title="No Courses Found"
          message={
            kindFilter || divisionFilter
              ? "No courses matched the selected filters."
              : "No courses are currently present in the active marksheet dataset."
          }
          action={
            kindFilter || divisionFilter ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setKindFilter('')
                  setDivisionFilter('')
                  setPage(1)
                }}
              >
                Reset Filters
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
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Modality</th>
                  <th>Credits</th>
                  <th>Evaluated Components</th>
                  <th style={{ textAlign: 'right' }}>Enrolled Headcount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.code}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {course.code}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{course.name}</div>
                    </td>
                    <td>
                      <span className={`badge ${course.kind === 'theory' ? 'badge-info' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                        {course.kind || 'Course'}
                      </span>
                    </td>
                    <td>{course.credits != null ? course.credits : '—'}</td>
                    <td>
                      {course.components && course.components.length > 0 ? (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {course.components.map((comp) => (
                            <span key={comp} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                              {comp}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {course.enrolled_students_count != null ? course.enrolled_students_count.toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/subjects/${encodeURIComponent(course.code)}/failures`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <TrendingDown size={13} style={{ color: '#ef4444' }} />
                        <span>Failures</span>
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {courses.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total.toLocaleString()} courses
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
    </div>
  )
}
