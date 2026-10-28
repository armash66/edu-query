import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Printer,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useHealth } from '../context/HealthContext'
import {
  getOverviewSummary,
  reviewAnomalyFinding,
  ApiError,
} from '../api/client'
import type {
  OverviewSummaryResponse,
  OverviewFlaggedStudent,
} from '../api/types'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import { Modal } from '../ui/Modal'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Skeleton } from '../ui/Skeleton'

export const OverviewPage: React.FC = () => {
  const { hasActiveSession } = useSession()
  const { refreshHealth } = useHealth()
  const navigate = useNavigate()

  const [summary, setSummary] = useState<OverviewSummaryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Evidence modal state for flagged student
  const [selectedStudent, setSelectedStudent] = useState<OverviewFlaggedStudent | null>(null)
  const [isReviewedMap, setIsReviewedMap] = useState<Record<string, boolean>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const fetchOverview = async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getOverviewSummary(signal)
      setSummary(data)
    } catch (err: unknown) {
      if ((err as any)?.name === 'AbortError' || signal?.aborted) {
        return
      }
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(500, 'LOAD_FAILED', 'Failed to load cohort overview summary.'))
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    if (hasActiveSession) {
      fetchOverview(controller.signal)
    } else {
      setLoading(false)
    }
    return () => controller.abort()
  }, [hasActiveSession])

  const handleToggleReview = async (student: OverviewFlaggedStudent) => {
    setReviewingId(student.finding_id)
    const currentlyReviewed = Boolean(isReviewedMap[student.finding_id])
    const nextReviewed = !currentlyReviewed
    try {
      await reviewAnomalyFinding(student.finding_id, {
        reviewed: nextReviewed,
        reviewer_name: 'Faculty Moderator',
        notes: nextReviewed ? 'Verified by faculty moderator' : undefined,
      })
      setIsReviewedMap((prev) => ({
        ...prev,
        [student.finding_id]: nextReviewed,
      }))
      await refreshHealth()
    } catch {
      // Non-blocking
    } finally {
      setReviewingId(null)
    }
  }

  // Handle empty state: redirect or prompt upload
  if (!hasActiveSession && !loading) {
    return (
      <div className="page-container" style={{ margin: '4rem auto', maxWidth: '800px' }}>
        <EmptyState
          title="No marksheet loaded"
          description="Please upload an Excel workbook (.xlsx) to analyze cohort performance."
          action={
            <Button variant="primary" onClick={() => navigate('/upload')}>
              Upload Marksheet
            </Button>
          }
        />
      </div>
    )
  }

  // Handle loading skeleton matching final layout
  if (loading) {
    return (
      <div className="page-container">
        {/* Heading Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton height="36px" width="300px" radius="var(--radius-sm)" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <Skeleton height="38px" width="160px" radius="var(--radius-sm)" />
            <Skeleton height="38px" width="120px" radius="var(--radius-sm)" />
          </div>
        </div>
        {/* KPI Row Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Skeleton height="100px" radius="var(--radius-card)" />
          <Skeleton height="100px" radius="var(--radius-card)" />
          <Skeleton height="100px" radius="var(--radius-card)" />
          <Skeleton height="100px" radius="var(--radius-card)" />
        </div>
        {/* Row 2 Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <Skeleton height="260px" radius="var(--radius-card)" />
          <Skeleton height="260px" radius="var(--radius-card)" />
        </div>
        {/* Row 3 Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <Skeleton height="240px" radius="var(--radius-card)" />
          <Skeleton height="240px" radius="var(--radius-card)" />
        </div>
      </div>
    )
  }

  // Handle error state with Retry
  if (error || !summary) {
    return (
      <div className="page-container" style={{ margin: '4rem auto', maxWidth: '800px' }}>
        <ErrorState
          title="Overview Error"
          message={error?.message || 'Unable to load cohort overview.'}
          onRetry={() => fetchOverview()}
        />
      </div>
    )
  }

  const { kpis, results, sgpi_distribution, hardest_subjects, highlights, dataset } = summary
  const flaggedCount = kpis.needs_attention_count

  // Median SGPI position for histogram (0.0 to 10.0 scale => 0% to 100%)
  const medianPct = sgpi_distribution.median !== null ? Math.min(100, Math.max(0, sgpi_distribution.median * 10)) : 89
  const maxBinCount = Math.max(...sgpi_distribution.bins.map((b) => b.count), 1)

  return (
    <div className="page-container">
      {/* 1. Heading Row */}
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
        aria-label="Overview header"
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Overview
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            {dataset.name} &bull; {kpis.total_students} students &bull; {kpis.total_courses} courses
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {flaggedCount > 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/data-quality')}
              data-testid="review-flagged-button"
            >
              <ShieldAlert size={16} />
              <span>Review {flaggedCount} flagged students</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            <span>Print summary</span>
          </Button>
        </div>
      </section>

      {/* 2. KPI Row: 4 Tiles (Equal size, neutral ink except amber accent on Needs Attention > 0) */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
        aria-label="Cohort KPIs"
      >
        {/* Tile 1: Students */}
        <GlassCard variant="glass-2" padding="md">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Students
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text)',
              lineHeight: 1.2,
              margin: '6px 0 4px 0',
            }}
            data-testid="kpi-total-students"
          >
            {kpis.total_students}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            across {kpis.divisions_count} divisions
          </div>
        </GlassCard>

        {/* Tile 2: Pass Rate */}
        <GlassCard variant="glass-2" padding="md">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pass rate
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text)',
              lineHeight: 1.2,
              margin: '6px 0 4px 0',
            }}
            data-testid="kpi-pass-rate"
          >
            {kpis.pass_rate_percent.toFixed(1)}%
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {kpis.passed_students} of {kpis.total_students} passed
          </div>
        </GlassCard>

        {/* Tile 3: Needs Attention (The ONLY tile allowed an accent) */}
        <GlassCard
          variant="glass-2"
          padding="md"
          style={
            flaggedCount > 0
              ? { borderLeft: '3px solid var(--status-warning-text)' }
              : undefined
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Needs attention
            </span>
            {flaggedCount > 0 && (
              <AlertTriangle size={15} color="var(--status-warning-text)" aria-hidden="true" />
            )}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: flaggedCount > 0 ? 'var(--status-warning-text)' : 'var(--text)',
              lineHeight: 1.2,
              margin: '6px 0 4px 0',
            }}
            data-testid="kpi-needs-attention"
          >
            {flaggedCount}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            students with flagged records
          </div>
        </GlassCard>

        {/* Tile 4: Average SGPI */}
        <GlassCard variant="glass-2" padding="md">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Average SGPI
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text)',
              lineHeight: 1.2,
              margin: '6px 0 4px 0',
            }}
            data-testid="kpi-average-sgpi"
          >
            {kpis.sgpi_average !== null ? kpis.sgpi_average.toFixed(1) : 'N/A'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            median {kpis.sgpi_median !== null ? kpis.sgpi_median.toFixed(1) : 'N/A'}, passed students
          </div>
        </GlassCard>
      </section>

      {/* 3. Row 2: 7 / 5 Columns (Needs Attention LEFT, Results RIGHT) */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '24px',
        }}
        aria-label="Attention and Results"
      >
        {/* LEFT (7 cols): Needs Attention Card */}
        <div style={{ gridColumn: 'span 7' }} className="overview-col-7">
          <GlassCard
            variant="glass-2"
            padding="md"
            headerSlot={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Needs attention
                </h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Top {summary.needs_attention.length} of {flaggedCount}
                </span>
              </div>
            }
            footerSlot={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link
                  to="/data-quality"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  data-testid="link-all-findings"
                >
                  <span>View all {flaggedCount} findings</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            }
          >
            {summary.needs_attention.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                No flagged records
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {summary.needs_attention.map((student, idx) => (
                  <div
                    key={student.student_id}
                    className={idx >= 3 ? 'overview-item-desktop-only' : ''}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-hover)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={student.student_name}
                        >
                          {student.student_name}
                        </span>
                        <StatusBadge
                          tone={student.severity === 'critical' ? 'fail' : 'warn'}
                          size="sm"
                          label={student.severity.toUpperCase()}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px',
                        }}
                        title={student.reason}
                      >
                        {student.reason}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedStudent(student)}
                        aria-label={`Review finding for ${student.student_name}`}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* RIGHT (5 cols): Results Card */}
        <div style={{ gridColumn: 'span 5' }} className="overview-col-5">
          <GlassCard
            variant="glass-2"
            padding="md"
            headerSlot={
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Results
              </h3>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Segmented Bar: Passed / Failed / Absent */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: 'var(--text-xs)' }}>
                  <span>
                    <strong>Passed:</strong> {results.passed.count} ({results.passed.percentage.toFixed(1)}%)
                  </span>
                  <span>
                    <strong style={{ color: 'var(--status-danger-text)' }}>Failed:</strong> {results.failed.count} ({results.failed.percentage.toFixed(1)}%)
                  </span>
                  {results.absent.count > 0 && (
                    <span>
                      <strong style={{ color: 'var(--status-warning-text)' }}>Absent:</strong> {results.absent.count} ({results.absent.percentage.toFixed(1)}%)
                    </span>
                  )}
                </div>

                {/* Progress Track */}
                <div
                  style={{
                    height: '14px',
                    width: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface-active)',
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                  role="progressbar"
                  aria-label="Cohort pass and fail outcomes"
                  aria-valuenow={results.passed.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {/* Passed segment: Neutral ink */}
                  <div
                    style={{
                      width: `${results.passed.percentage}%`,
                      background: 'var(--neutral-900)',
                      height: '100%',
                    }}
                    title={`Passed: ${results.passed.percentage}%`}
                  />
                  {/* Failed segment: Muted red */}
                  <div
                    style={{
                      width: `${results.failed.percentage}%`,
                      background: 'var(--status-danger-text)',
                      height: '100%',
                    }}
                    title={`Failed: ${results.failed.percentage}%`}
                  />
                  {/* Absent segment: Amber */}
                  {results.absent.percentage > 0 && (
                    <div
                      style={{
                        width: `${results.absent.percentage}%`,
                        background: 'var(--status-warning-text)',
                        height: '100%',
                      }}
                      title={`Absent: ${results.absent.percentage}%`}
                    />
                  )}
                </div>
              </div>

              {/* By Division Breakdown */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  By division
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {results.divisions.map((div) => (
                    <div key={div.division_code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {div.division}
                        </span>
                        <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {div.passed} of {div.enrolled} passed &bull; {div.pass_rate_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: '8px',
                          width: '100%',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--surface-active)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${div.pass_rate_percent}%`,
                            background: 'var(--neutral-700)',
                            height: '100%',
                            borderRadius: 'var(--radius-full)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 4. Row 3: 5 / 7 Columns (SGPI Histogram LEFT, Hardest Subjects RIGHT) */}
      <section
        className="overview-row-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '24px',
        }}
        aria-label="Distribution and Hardest Subjects"
      >
        {/* LEFT (5 cols): SGPI Distribution */}
        <div style={{ gridColumn: 'span 5' }} className="overview-col-5 overview-order-sgpi">
          <GlassCard
            variant="glass-2"
            padding="md"
            headerSlot={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  SGPI distribution
                </h3>
                <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Median {sgpi_distribution.median !== null ? sgpi_distribution.median.toFixed(1) : 'N/A'}
                </span>
              </div>
            }
            footerSlot={
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {sgpi_distribution.students_without_sgpi} students without SGPI (failed)
              </div>
            }
          >
            {/* Visual Histogram Chart */}
            <div style={{ position: 'relative', height: '140px', display: 'flex', alignItems: 'flex-end', gap: '6px', paddingTop: '20px' }}>
              {/* Median Marker Line */}
              <div
                style={{
                  position: 'absolute',
                  left: `${medianPct}%`,
                  top: '0',
                  bottom: '20px',
                  width: '2px',
                  background: 'var(--text)',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
                title={`Median: ${sgpi_distribution.median}`}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Med {sgpi_distribution.median}
                </div>
              </div>

              {/* Bars */}
              {sgpi_distribution.bins.map((bin) => {
                const barHeightPct = (bin.count / maxBinCount) * 100
                return (
                  <div
                    key={bin.bin_label}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(barHeightPct, 2)}%`,
                        background: bin.count > 0 ? 'var(--neutral-700)' : 'var(--surface-active)',
                        borderRadius: '2px 2px 0 0',
                        transition: 'height var(--transition-normal)',
                      }}
                      title={`${bin.bin_label}: ${bin.count} students (${bin.percentage}%)`}
                    />
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                      {bin.bin_label}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Screen Reader Accessible Table Fallback */}
            <table className="sr-only" aria-label="SGPI score distribution histogram values">
              <thead>
                <tr>
                  <th scope="col">SGPI Bin</th>
                  <th scope="col">Student Count</th>
                  <th scope="col">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {sgpi_distribution.bins.map((b) => (
                  <tr key={b.bin_label}>
                    <td>{b.bin_label}</td>
                    <td>{b.count}</td>
                    <td>{b.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>

        {/* RIGHT (7 cols): Hardest Subjects (Single Column List) */}
        <div style={{ gridColumn: 'span 7' }} className="overview-col-7 overview-order-hardest">
          <GlassCard
            variant="glass-2"
            padding="md"
            headerSlot={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Hardest subjects
                </h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  By failure rate
                </span>
              </div>
            }
            footerSlot={
              <Link
                to="/subjects"
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>All subjects</span>
                <ArrowRight size={14} />
              </Link>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {hardest_subjects.slice(0, 5).map((subject, idx) => {
                // Tier colors: under 5% neutral gray, 5-15% amber, over 15% red
                const barColor =
                  subject.tier === 'red'
                    ? 'var(--status-danger-text)'
                    : subject.tier === 'amber'
                    ? 'var(--status-warning-text)'
                    : 'var(--neutral-500)'

                return (
                  <div key={subject.course_code} className={idx >= 3 ? 'overview-item-desktop-only' : ''}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 'var(--text-xs)',
                        gap: '12px',
                        marginBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <code
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: 'var(--text)',
                            fontSize: '11px',
                            background: 'var(--surface-hover)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            flexShrink: 0,
                          }}
                        >
                          {subject.course_code}
                        </code>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)',
                          }}
                          title={subject.course_title}
                        >
                          {subject.course_title}
                        </span>
                      </div>

                      <div
                        className="tabular-nums"
                        style={{
                          flexShrink: 0,
                          textAlign: 'right',
                          fontWeight: 600,
                          color: subject.tier === 'neutral' ? 'var(--text-secondary)' : barColor,
                        }}
                      >
                        {subject.failed_count} of {subject.enrolled_count} ({subject.failure_rate_percent.toFixed(1)}%)
                      </div>
                    </div>

                    {/* Thin bar using tier rule from A1 */}
                    <div
                      style={{
                        height: '6px',
                        width: '100%',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface-active)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(subject.failure_rate_percent * 4, 3))}%`,
                          background: barColor,
                          height: '100%',
                          borderRadius: 'var(--radius-full)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 5. Row 4: Highlights Strip (Full width, auto-generated deterministic template sentences) */}
      {highlights.length > 0 && (
        <section aria-label="Cohort insights and highlights">
          <GlassCard variant="glass-1" padding="sm">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
                gap: '12px',
                padding: '4px',
              }}
            >
              {highlights.map((item) => (
                <Link
                  key={item.id}
                  to={item.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    textDecoration: 'none',
                    color: 'var(--text)',
                    fontSize: 'var(--text-xs)',
                    lineHeight: 1.4,
                    transition: 'background var(--transition-fast)',
                  }}
                  data-testid={`highlight-${item.id}`}
                >
                  <span>{item.text}</span>
                  <ArrowRight size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                </Link>
              ))}
            </div>
          </GlassCard>
        </section>
      )}

      {/* 6. On-Demand Evidence Modal */}
      {selectedStudent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudent(null)}
          title="Review Finding Evidence"
          description={`Integrity verification for ${selectedStudent.student_name} (${selectedStudent.student_id})`}
          size="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
              <Button variant="ghost" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
              <Button
                variant={isReviewedMap[selectedStudent.finding_id] ? 'secondary' : 'primary'}
                loading={reviewingId === selectedStudent.finding_id}
                onClick={() => handleToggleReview(selectedStudent)}
              >
                {isReviewedMap[selectedStudent.finding_id]
                  ? 'Unverify Finding'
                  : 'Mark as Reviewed & Verified'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Reason Flagged
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                {selectedStudent.reason}
              </p>
            </div>

            {selectedStudent.evidence && (
              <div
                style={{
                  background: 'var(--surface-hover)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                  Observed Evidence:
                </div>
                <div>{selectedStudent.evidence}</div>
              </div>
            )}

            {selectedStudent.recommended_action && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <strong>Recommended Action:</strong> {selectedStudent.recommended_action}
              </div>
            )}

            {selectedStudent.record_link && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <Link
                  to={selectedStudent.record_link}
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text)',
                    textDecoration: 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Open detailed student profile</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default OverviewPage
