import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react'
import { getDataQuality } from '../api/client'
import { ApiError, type DataQualityResponse, type DataQualityFindingItem } from '../api/types'
import {
  GlassCard,
  StatusBadge,
  Stat,
  EmptyState,
  ErrorState,
} from '../ui'
import { LoadingState } from '../components/LoadingState'

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const fetchQuality = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDataQuality()
      setData(res)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve data quality audit'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuality()
  }, [fetchQuality])

  const filteredFindings = useMemo(() => {
    if (!data?.findings) return []
    if (severityFilter === 'all') return data.findings
    return data.findings.filter((f) => f.severity.toLowerCase() === severityFilter.toLowerCase())
  }, [data?.findings, severityFilter])

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <GlassCard elevation={1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldCheck size={22} style={{ color: 'var(--text-primary)' }} />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Data Quality & Ingestion Diagnostics
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Audits marksheet structure, component reconciliations, and academic rule consistency.
            </p>
          </div>

          {/* Severity Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={15} style={{ color: 'var(--text-tertiary)' }} />
            <div
              role="group"
              aria-label="Filter findings by severity"
              style={{
                display: 'inline-flex',
                background: 'var(--glass-base)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-pill)',
                padding: '2px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  background: severityFilter === 'all' ? 'var(--text-primary)' : 'transparent',
                  color: severityFilter === 'all' ? 'var(--bg-canvas)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setSeverityFilter('all')}
              >
                All ({data?.findings?.length || 0})
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: severityFilter === 'error' ? 'var(--status-fail)' : 'transparent',
                  color: severityFilter === 'error' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setSeverityFilter('error')}
              >
                Errors ({data?.error_count || 0})
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: severityFilter === 'warning' ? 'var(--status-warn)' : 'transparent',
                  color: severityFilter === 'warning' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setSeverityFilter('warning')}
              >
                Warnings ({data?.warning_count || 0})
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: severityFilter === 'info' ? 'var(--status-info)' : 'transparent',
                  color: severityFilter === 'info' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setSeverityFilter('info')}
              >
                Info ({data?.info_count || 0})
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {error && (
        <ErrorState
          error={error.message || 'Could not load data quality report'}
          onRetry={fetchQuality}
        />
      )}

      {loading && !data ? (
        <LoadingState message="Auditing active marksheet dataset against data-quality rules..." />
      ) : data ? (
        <>
          {/* Quality Summary Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <GlassCard elevation={2}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Overall Integrity Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {data.quality_score}%
                  </span>
                  <StatusBadge
                    tone={
                      data.health_status === 'Good'
                        ? 'pass'
                        : data.health_status === 'Needs Attention'
                        ? 'warn'
                        : 'fail'
                    }
                  >
                    {data.health_status}
                  </StatusBadge>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Evaluated across {data.total_checks} automated integrity checks
                </div>
              </div>
            </GlassCard>

            <Stat
              label="Blocking Anomalies"
              value={data.error_count}
              subtext="Critical structural or mathematical errors"
            />

            <Stat
              label="Warnings & Observations"
              value={data.warning_count + data.info_count}
              subtext={`${data.warning_count} warnings, ${data.info_count} informational`}
            />
          </div>

          {/* Clean Report Notice */}
          <div
            style={{
              padding: '0.875rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--status-info-subtle)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
            }}
          >
            <AlertCircle size={18} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Audit Scope Disclaimer:</strong> A clean report means the configured integrity rules
              detected no structural contradictions or component mismatches. It does not certify that external
              transcription errors in source sheets are impossible.
            </div>
          </div>

          {/* Findings Table */}
          {filteredFindings.length === 0 ? (
            <GlassCard elevation={1}>
              <EmptyState
                icon={<CheckCircle2 size={36} style={{ color: 'var(--status-pass)' }} />}
                title={
                  severityFilter === 'all'
                    ? 'No Data Quality Findings'
                    : `No ${severityFilter} findings detected`
                }
                description="All executed automated checks completed without raising findings in this category."
              />
            </GlassCard>
          ) : (
            <GlassCard elevation={1} padding="none">
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Detailed Quality Findings
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Showing {filteredFindings.length} findings
                </span>
              </div>

              <div className="glass-scrollbar" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.75rem 1.25rem', width: '120px' }}>Severity</th>
                      <th style={{ padding: '0.75rem 1.25rem', width: '260px' }}>Problem / Rule</th>
                      <th style={{ padding: '0.75rem 1.25rem' }}>Impact on Analytics</th>
                      <th style={{ padding: '0.75rem 1.25rem' }}>Recommended Action</th>
                      <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', width: '90px' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFindings.map((finding: DataQualityFindingItem) => {
                      const sev = finding.severity.toLowerCase()
                      const tone = sev === 'error' ? 'fail' : sev === 'warning' ? 'warn' : 'info'

                      return (
                        <tr
                          key={finding.check_id}
                          style={{
                            borderBottom: '1px solid var(--glass-border)',
                            transition: 'background var(--transition-fast)',
                          }}
                        >
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <StatusBadge tone={tone}>{finding.severity.toUpperCase()}</StatusBadge>
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{finding.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {finding.problem}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                              {finding.check_id}
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {finding.impact}
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <div
                              style={{
                                fontSize: '0.78125rem',
                                color: 'var(--text-primary)',
                                background: 'var(--glass-base)',
                                border: '1px solid var(--glass-border)',
                                padding: '0.4rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                lineHeight: 1.4,
                              }}
                            >
                              {finding.recommended_action}
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {finding.count.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </>
      ) : null}
    </div>
  )
}
