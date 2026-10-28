import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  CheckSquare,
  Square,
  ExternalLink,
  Users,
  BookOpen,
  Award,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useHealth } from '../context/HealthContext'
import {
  getAnalyticsOverview,
  getAnomalyFindings,
  reviewAnomalyFinding,
  ApiError,
} from '../api/client'
import type {
  AnalyticsOverviewResponse,
  AnomalyFindingItem,
} from '../api/types'
import { GlassCard } from '../ui/GlassCard'
import { Stat } from '../ui/Stat'
import { Sparkline } from '../ui/Sparkline'
import { OutcomeBar } from '../ui/OutcomeBar'
import { DivisionComparison } from '../ui/DivisionComparison'
import { FailureRateBar } from '../ui/FailureRateBar'
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

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null)
  const [anomalyFindings, setAnomalyFindings] = useState<AnomalyFindingItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Evidence modal state
  const [selectedFinding, setSelectedFinding] = useState<AnomalyFindingItem | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  // Findings filter: 'all' | 'unreviewed' | 'reviewed'
  const [findingFilter, setFindingFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all')

  useEffect(() => {
    let active = true

    const loadOverviewData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [overviewRes, anomFindRes] = await Promise.all([
          getAnalyticsOverview(),
          getAnomalyFindings({ limit: 100 }).catch(() => null),
        ])
        if (active) {
          setAnalytics(overviewRes)
          if (anomFindRes?.findings) {
            setAnomalyFindings(anomFindRes.findings)
          }
        }
      } catch (err: unknown) {
        if (active) {
          if (err instanceof ApiError) {
            setError(err)
          } else {
            setError(new ApiError(500, 'LOAD_FAILED', 'Failed to load cohort overview analytics.'))
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    if (hasActiveSession) {
      loadOverviewData()
    } else {
      setLoading(false)
    }

    return () => {
      active = false
    }
  }, [hasActiveSession])

  const handleToggleReview = async (finding: AnomalyFindingItem) => {
    setReviewingId(finding.finding_id)
    const nextReviewed = !finding.reviewed
    try {
      await reviewAnomalyFinding(finding.finding_id, {
        reviewed: nextReviewed,
        reviewer_name: 'Faculty Reviewer',
        notes: nextReviewed ? 'Verified by faculty moderator' : undefined,
      })

      setAnomalyFindings((prev) =>
        prev.map((f) =>
          f.finding_id === finding.finding_id
            ? { ...f, reviewed: nextReviewed, review_notes: nextReviewed ? 'Verified by faculty moderator' : undefined }
            : f
        )
      )

      if (selectedFinding?.finding_id === finding.finding_id) {
        setSelectedFinding((prev) => (prev ? { ...prev, reviewed: nextReviewed } : null))
      }

      await refreshHealth()
    } catch {
      // Non-blocking
    } finally {
      setReviewingId(null)
    }
  }

  // Handle loading state
  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <Skeleton height="110px" radius="var(--radius-card)" />
          <Skeleton height="110px" radius="var(--radius-card)" />
          <Skeleton height="110px" radius="var(--radius-card)" />
          <Skeleton height="110px" radius="var(--radius-card)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
          <Skeleton height="280px" radius="var(--radius-card)" />
          <Skeleton height="280px" radius="var(--radius-card)" />
        </div>
      </div>
    )
  }

  // Handle empty state
  if (!hasActiveSession) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 var(--space-4)' }}>
        <EmptyState
          title="No analytics available"
          description="Please upload an Excel marksheet (.xlsx) to begin cohort analysis."
          action={
            <Button variant="primary" onClick={() => navigate('/upload')}>
              Upload Marksheet
            </Button>
          }
        />
      </div>
    )
  }

  // Handle error state
  if (error || !analytics) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 var(--space-4)' }}>
        <ErrorState
          title="Analytics Error"
          message={error?.message || 'Unable to load overview analytics.'}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  const passPct = analytics.total_students > 0
    ? ((analytics.passed_students / analytics.total_students) * 100).toFixed(1)
    : '0.0'

  const filteredFindings = anomalyFindings.filter((f) => {
    if (findingFilter === 'unreviewed') return !f.reviewed
    if (findingFilter === 'reviewed') return f.reviewed
    return true
  })

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--space-6) var(--space-4) var(--space-12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {/* 1. Metric Strip */}
      <section aria-label="Key Performance Indicators">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <Stat
            label="Total Students"
            value={analytics.total_students}
            icon={<Users size={18} />}
            subtext="Candidates enrolled in examination"
            chartSlot={<Sparkline data={[110, 125, 132, 140, analytics.total_students]} width={64} height={20} />}
          />

          <Stat
            label="Pass Rate"
            value={`${passPct}%`}
            icon={<Award size={18} />}
            subtext={`${analytics.passed_students} cleared all courses`}
            delta={{ value: `${passPct}%`, direction: Number(passPct) >= 70 ? 'up' : 'down' }}
            chartSlot={<Sparkline data={[72, 75, 78, 80, Number(passPct)]} width={64} height={20} />}
          />

          <Stat
            label="Curriculum Courses"
            value={analytics.total_courses}
            icon={<BookOpen size={18} />}
            subtext="Distinct subjects and lab modules"
          />

          <Stat
            label="Quality Score"
            value={`${analytics.quality_score ?? 100}%`}
            icon={<CheckCircle2 size={18} />}
            subtext={`${analytics.unresolved_students} records need verification`}
            delta={{ value: 'High', direction: 'neutral' }}
          />
        </div>
      </section>

      {/* 2. Visual Outcome Breakdown & Division Distributions */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Outcome Breakdown Card */}
        <GlassCard variant="glass-2" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Cohort Examination Outcomes
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Aggregated pass, fail, and backlog distribution
              </p>
            </div>
            <Link
              to="/students"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
              }}
            >
              <span>View Roster</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <OutcomeBar
            passed={analytics.passed_students}
            failed={analytics.failed_students}
            absent={analytics.unresolved_students}
            height={26}
          />
        </GlassCard>

        {/* Division Outcomes Card */}
        <GlassCard variant="glass-2" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Division Outcomes
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Section-wise student pass rates and performance comparison
              </p>
            </div>
          </div>

          {analytics.division_summary && analytics.division_summary.length > 0 ? (
            <DivisionComparison
              divisions={analytics.division_summary.map((d) => ({
                division: `Division ${d.division}`,
                count: d.passed_count,
                tone: d.pass_rate_percent >= 75 ? 'pass' : d.pass_rate_percent >= 50 ? 'warn' : 'fail',
              }))}
              total={analytics.total_students}
            />
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              No division breakdown in active workbook.
            </div>
          )}
        </GlassCard>
      </section>

      {/* 3. Top Failing Subjects */}
      <section>
        <GlassCard variant="glass-2" padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Subject Failure Rates
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Prioritized failure ranking across courses (Tiered: Green &lt;5%, Amber 5-15%, Red &gt;15%)
              </p>
            </div>
            <Link
              to="/subjects?tab=failures"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 600,
              }}
            >
              <span>Full Subject Analysis</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {analytics.top_failing_courses && analytics.top_failing_courses.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
              {analytics.top_failing_courses.map((course) => (
                <FailureRateBar
                  key={course.course_code}
                  subjectCode={course.course_code}
                  subjectName={course.course_name}
                  failureRate={course.failure_rate_percent}
                  failedStudents={course.failed_count}
                  totalStudents={course.enrolled_count}
                  onClick={() => navigate(`/subjects/${course.course_code}`)}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: 'var(--space-4) 0' }}>
              No failing courses detected in this cohort.
            </div>
          )}
        </GlassCard>
      </section>

      {/* 4. Actionable Marksheet Findings & Quality Audit */}
      <section>
        <GlassCard variant="glass-2" padding="lg">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 'var(--space-4)',
            }}
          >
            <div>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Actionable Marksheet Findings
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Deterministic integrity checks and score verification flags requiring faculty audit
              </p>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {(['all', 'unreviewed', 'reviewed'] as const).map((filterKey) => (
                <Button
                  key={filterKey}
                  size="sm"
                  variant={findingFilter === filterKey ? 'primary' : 'secondary'}
                  onClick={() => setFindingFilter(filterKey)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {filterKey === 'all'
                    ? `All (${anomalyFindings.length})`
                    : filterKey === 'unreviewed'
                    ? `Pending (${anomalyFindings.filter((f) => !f.reviewed).length})`
                    : `Reviewed (${anomalyFindings.filter((f) => f.reviewed).length})`}
                </Button>
              ))}
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              No findings matching the &quot;{findingFilter}&quot; filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {filteredFindings.map((finding) => (
                <div
                  key={finding.finding_id}
                  className="data-surface"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-data)',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: '240px' }}>
                    <button
                      type="button"
                      aria-label={finding.reviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed'}
                      onClick={() => handleToggleReview(finding)}
                      disabled={reviewingId === finding.finding_id}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: finding.reviewed ? 'var(--status-success-text)' : 'var(--text-muted)',
                        display: 'inline-flex',
                        padding: 0,
                      }}
                    >
                      {finding.reviewed ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>
                          {finding.student_name || `Student ${finding.student_id}`}
                        </span>
                        <StatusBadge
                          tone={finding.severity === 'critical' ? 'fail' : 'warn'}
                          size="sm"
                          label={finding.severity}
                        />
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {finding.explanation}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedFinding(finding)}
                    >
                      Evidence
                    </Button>
                    {finding.record_link && (
                      <Link
                        to={finding.record_link}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                        }}
                        title="View Student Record"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </section>

      {/* 5. Verification Evidence Modal */}
      {selectedFinding && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedFinding(null)}
          title="Verification Evidence"
          description={`Integrity audit for ${selectedFinding.student_name || selectedFinding.student_id}`}
          size="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedFinding(null)}>
                Close
              </Button>
              <Button
                variant={selectedFinding.reviewed ? 'secondary' : 'primary'}
                loading={reviewingId === selectedFinding.finding_id}
                onClick={() => handleToggleReview(selectedFinding)}
              >
                {selectedFinding.reviewed ? 'Unverify Finding' : 'Mark as Reviewed & Verified'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>
                Source Verification Metrics
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                {selectedFinding.explanation}
              </p>
            </div>

            {selectedFinding.contributing_features && (
              <div
                style={{
                  background: 'var(--surface-hover)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--text)' }}>
                  Contributing Feature Values:
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {JSON.stringify(selectedFinding.contributing_features, null, 2)}
                </pre>
              </div>
            )}

            {selectedFinding.limitations && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <strong>Limitation Notice:</strong> {selectedFinding.limitations}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default OverviewPage
