import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  CheckSquare,
  Square,
  X,
  ExternalLink,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useHealth } from '../context/HealthContext'
import {
  getAnalyticsOverview,
  getAnomalyFindings,
  getAnomalySummary,
  reviewAnomalyFinding,
  ApiError,
} from '../api/client'
import type {
  AnalyticsOverviewResponse,
  AnomalyFindingItem,
  AnomalySummaryResponse,
} from '../api/types'
import { HorizontalRankingChart } from '../components/charts/HorizontalRankingChart'
import { DivisionComparisonChart } from '../components/charts/DivisionComparisonChart'
import { LoadingState } from '../components/LoadingState'
import { ErrorBanner } from '../components/ErrorBanner'

export const OverviewPage: React.FC = () => {
  const { hasActiveSession } = useSession()
  const { refreshHealth } = useHealth()
  const navigate = useNavigate()

  const [analytics, setAnalytics] = useState<AnalyticsOverviewResponse | null>(null)
  const [anomalySummary, setAnomalySummary] = useState<AnomalySummaryResponse | null>(null)
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
        const [overviewRes, anomSumRes, anomFindRes] = await Promise.all([
          getAnalyticsOverview(),
          getAnomalySummary().catch(() => null),
          getAnomalyFindings({ limit: 100 }).catch(() => null),
        ])
        if (active) {
          setAnalytics(overviewRes)
          if (anomSumRes) setAnomalySummary(anomSumRes)
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

      // Update state
      setAnomalyFindings((prev) =>
        prev.map((f) =>
          f.finding_id === finding.finding_id
            ? { ...f, reviewed: nextReviewed, reviewed_by: nextReviewed ? 'Faculty Reviewer' : null }
            : f
        )
      )

      if (selectedFinding?.finding_id === finding.finding_id) {
        setSelectedFinding({
          ...selectedFinding,
          reviewed: nextReviewed,
          reviewed_by: nextReviewed ? 'Faculty Reviewer' : null,
        })
      }

      if (anomalySummary) {
        setAnomalySummary({
          ...anomalySummary,
          reviewed_count: nextReviewed
            ? anomalySummary.reviewed_count + 1
            : Math.max(0, anomalySummary.reviewed_count - 1),
          pending_count: nextReviewed
            ? Math.max(0, anomalySummary.pending_count - 1)
            : anomalySummary.pending_count + 1,
        })
      }
    } catch {
      // Non-blocking
    } finally {
      setReviewingId(null)
    }
  }

  if (loading) {
    return <LoadingState message="Loading cohort performance overview..." />
  }

  if (error) {
    return <ErrorBanner error={error} title="Analytics Error" onRetry={() => refreshHealth()} />
  }

  if (!analytics) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No analytics available. Please upload a marksheet.
      </div>
    )
  }

  // Authoritative pass percentage calculation
  const passRatePercent =
    analytics.total_students > 0
      ? ((analytics.passed_students / analytics.total_students) * 100).toFixed(1)
      : '0.0'

  // Filtered findings list
  const filteredFindings = anomalyFindings.filter((f) => {
    if (findingFilter === 'unreviewed') return !f.reviewed
    if (findingFilter === 'reviewed') return f.reviewed
    return true
  })

  // Distinct students requiring attention
  const distinctStudentsNeedingReview = new Set(
    anomalyFindings.filter((f) => !f.reviewed).map((f) => f.student_id)
  ).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Compact Cohort Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {/* Cohort Size */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cohort Size
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
            {analytics.total_students}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Enrolled Students
          </div>
        </div>

        {/* Pass Rate */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Overall Pass Rate
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#047857', marginTop: '0.2rem' }}>
            {passRatePercent}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {analytics.passed_students} passed &bull; {analytics.failed_students} failed
          </div>
        </div>

        {/* Records Needing Attention */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Attention Required
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: distinctStudentsNeedingReview > 0 ? '#b45309' : '#047857',
              marginTop: '0.2rem',
            }}
          >
            {distinctStudentsNeedingReview}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            {distinctStudentsNeedingReview > 0 ? 'Distinct student records pending review' : 'Zero unreviewed anomalies'}
          </div>
        </div>

        {/* Total Courses */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Curriculum Courses
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
            {analytics.total_courses}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Evaluated subjects in cohort
          </div>
        </div>
      </div>

      {/* 2. Primary Comparison Grid: Subjects & Divisions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Subject Failure Outcomes */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Subject Failure Rates
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Ranked by failure percentage among enrolled candidates
              </div>
            </div>
            <Link
              to="/subjects"
              style={{ fontSize: '0.78rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}
            >
              All subjects &rarr;
            </Link>
          </div>

          <HorizontalRankingChart
            data={analytics.top_failing_courses}
            onSelectCourse={(courseCode) => navigate(`/subjects/${courseCode}/failures`)}
          />
        </div>

        {/* Division Breakdown */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Division Outcomes
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Pass and fail proportions across class sections
              </div>
            </div>
            <Link
              to="/students"
              style={{ fontSize: '0.78rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}
            >
              Student roster &rarr;
            </Link>
          </div>

          {analytics.division_summary && analytics.division_summary.length > 0 ? (
            <DivisionComparisonChart
              data={analytics.division_summary}
              onSelectDivision={(div) => navigate(`/students?division=${encodeURIComponent(div)}`)}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No division partition detected in this cohort.
            </div>
          )}
        </div>
      </div>

      {/* 3. Actionable Verification & Audit Findings */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Actionable Marksheet Findings
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Deterministic discrepancies and statistical anomalies requiring faculty inspection
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className={`btn btn-xs ${findingFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFindingFilter('all')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              All ({anomalyFindings.length})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${findingFilter === 'unreviewed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFindingFilter('unreviewed')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              Needs Review ({anomalyFindings.filter((f) => !f.reviewed).length})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${findingFilter === 'reviewed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFindingFilter('reviewed')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              Reviewed ({anomalyFindings.filter((f) => f.reviewed).length})
            </button>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontSize: '0.85rem',
            }}
          >
            <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {findingFilter === 'unreviewed'
                ? 'All detected findings have been verified by faculty.'
                : 'No marksheet discrepancies detected in this cohort.'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Grade rules, component arithmetic, and total scores reconcile with 100% consistency.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredFindings.map((finding) => (
              <div
                key={finding.finding_id}
                style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: finding.reviewed ? '#f8fafc' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flexGrow: 1 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleReview(finding)}
                    disabled={reviewingId === finding.finding_id}
                    title={finding.reviewed ? 'Mark as unreviewed' : 'Mark as reviewed'}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: finding.reviewed ? '#059669' : '#94a3b8',
                      marginTop: '0.15rem',
                    }}
                  >
                    {finding.reviewed ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          fontWeight: 600,
                          backgroundColor:
                            finding.severity === 'critical'
                              ? '#fee2e2'
                              : finding.severity === 'warning'
                              ? '#fef3c7'
                              : '#f1f5f9',
                          color:
                            finding.severity === 'critical'
                              ? '#991b1b'
                              : finding.severity === 'warning'
                              ? '#92400e'
                              : '#475569',
                          textTransform: 'uppercase',
                        }}
                      >
                        {finding.category || finding.severity}
                      </span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {finding.title || finding.explanation}
                      </span>
                    </div>

                    {finding.what_noticed && finding.title && (
                      <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.25rem' }}>
                        {finding.what_noticed}
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Student ID: <code style={{ fontSize: '0.75rem' }}>{finding.student_id}</code>
                      {finding.course_code && (
                        <> &bull; Subject: <code style={{ fontSize: '0.75rem' }}>{finding.course_code}</code></>
                      )}
                      {finding.reviewed && (
                        <span style={{ color: '#059669', marginLeft: '0.5rem' }}>
                          &bull; Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setSelectedFinding(finding)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.55rem',
                    flexShrink: 0,
                  }}
                >
                  Evidence <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. On-Demand Evidence Modal / Drawer */}
      {selectedFinding && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedFinding(null)
          }}
        >
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: 'var(--primary-color)' }} />
                <h3 className="modal-title" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Verification Evidence
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setSelectedFinding(null)}
                aria-label="Close evidence modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Observation
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {selectedFinding.title || selectedFinding.explanation}
                </div>
                {selectedFinding.what_noticed && selectedFinding.title && (
                  <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.35rem', lineHeight: '1.4' }}>
                    {selectedFinding.what_noticed}
                  </div>
                )}
              </div>

              {selectedFinding.evidence && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#166534', textTransform: 'uppercase', fontWeight: 700 }}>
                    Verifiable Evidence
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#14532d', marginTop: '0.2rem' }}>
                    {selectedFinding.evidence}
                  </div>
                </div>
              )}

              {selectedFinding.recommended_action && (
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>
                    Recommended Action
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#1e3a8a', marginTop: '0.2rem' }}>
                    {selectedFinding.recommended_action}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  backgroundColor: '#f8fafc',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Student Identifier:</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedFinding.student_id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Subject Code:</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedFinding.course_code || 'Cohort-wide'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Severity Level:</div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedFinding.severity}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Detection Category:</div>
                  <div style={{ fontWeight: 600 }}>{selectedFinding.category || 'Deterministic Check'}</div>
                </div>
              </div>

              {/* Source Verification Metrics / Technical Details */}
              {(selectedFinding.technical_details || (selectedFinding.contributing_features && Object.keys(selectedFinding.contributing_features).length > 0)) && (
                <details open style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem' }}>
                  <summary style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                    Statistical Model & Technical Details
                  </summary>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                    {selectedFinding.technical_details && (
                      <p style={{ margin: '0 0 0.5rem 0' }}>{selectedFinding.technical_details}</p>
                    )}
                    {selectedFinding.contributing_features && Object.keys(selectedFinding.contributing_features).length > 0 && (
                      <div
                        style={{
                          backgroundColor: '#f1f5f9',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          overflowX: 'auto',
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Source Verification Metrics
                        </div>
                        <pre style={{ margin: 0 }}>{JSON.stringify(selectedFinding.contributing_features, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {selectedFinding.review_notes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Moderation Notes:</strong> {selectedFinding.review_notes}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className={`btn btn-sm ${selectedFinding.reviewed ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => handleToggleReview(selectedFinding)}
                disabled={reviewingId === selectedFinding.finding_id}
              >
                {selectedFinding.reviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed & Verified'}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedFinding(null)
                  navigate(`/students/${encodeURIComponent(selectedFinding.student_id)}`)
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                Inspect Student Roster <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
