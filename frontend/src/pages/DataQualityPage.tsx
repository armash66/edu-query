import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  Info,
  CheckCircle2,
  Filter,
} from 'lucide-react'
import { getDataQuality } from '../api/client'
import { ApiError, type DataQualityResponse, type DataQualityFindingItem } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { ErrorBanner } from '../components/ErrorBanner'

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
    <div>
      {/* Header Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                Data Quality & Ingestion Diagnostics
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Audits marksheet structure, component reconciliations, and academic rule consistency.
              </div>
            </div>

            {/* Severity Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.2rem', borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${severityFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                  onClick={() => setSeverityFilter('all')}
                >
                  All ({data?.findings?.length || 0})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${severityFilter === 'error' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                  onClick={() => setSeverityFilter('error')}
                >
                  Errors ({data?.error_count || 0})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${severityFilter === 'warning' ? 'btn-warning' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                  onClick={() => setSeverityFilter('warning')}
                >
                  Warnings ({data?.warning_count || 0})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${severityFilter === 'info' ? 'btn-secondary' : 'btn-secondary'}`}
                  style={{ border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.78rem', backgroundColor: severityFilter === 'info' ? '#bfdbfe' : undefined }}
                  onClick={() => setSeverityFilter('info')}
                >
                  Info ({data?.info_count || 0})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} title="Could not load data quality report" onRetry={fetchQuality} />}

      {loading && !data ? (
        <LoadingState message="Auditing active marksheet dataset against data-quality rules..." />
      ) : data ? (
        <>
          {/* Quality Summary Ribbon */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Overall Integrity Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    {data.quality_score}%
                  </span>
                  <StatusBadge
                    status={
                      data.health_status === 'Good'
                        ? 'passed'
                        : data.health_status === 'Needs Attention'
                        ? 'warning'
                        : 'failed'
                    }
                    text={data.health_status}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Evaluated across {data.total_checks} automated integrity checks
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Blocking Anomalies
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: data.error_count > 0 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                  {data.error_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Critical structural or mathematical errors
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Warnings & Non-Blocking Notes
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
                  {data.warning_count + data.info_count}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {data.warning_count} warnings, {data.info_count} informational observations
                </div>
              </div>
            </div>
          </div>

          {/* Clean Report Notice */}
          <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong>Audit Scope Disclaimer:</strong> A clean report means the configured integrity rules
              detected no structural contradictions or component mismatches. It does not certify that external
              transcription errors in source sheets are impossible.
            </div>
          </div>

          {/* Findings Table */}
          {filteredFindings.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#065f46', marginBottom: '0.4rem' }}>
                  {severityFilter === 'all'
                    ? 'No Data Quality Findings'
                    : `No ${severityFilter} findings detected`}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
                  All executed automated checks completed without raising findings in this category.
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <span>Detailed Quality Findings</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {filteredFindings.length} findings
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Severity</th>
                      <th style={{ width: '220px' }}>Problem / Rule</th>
                      <th>Impact on Analytics</th>
                      <th>Recommended Action</th>
                      <th style={{ textAlign: 'right', width: '90px' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFindings.map((finding: DataQualityFindingItem) => {
                      const sev = finding.severity.toLowerCase()
                      const statusType = sev === 'error' ? 'error' : sev === 'warning' ? 'warning' : 'info'

                      return (
                        <tr key={finding.check_id}>
                          <td>
                            <StatusBadge status={statusType} text={finding.severity.toUpperCase()} />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{finding.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: '0.2rem' }}>
                              {finding.problem}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                              {finding.check_id}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>{finding.impact}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: '#1e40af', backgroundColor: '#eff6ff', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                              {finding.recommended_action}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {finding.count.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
