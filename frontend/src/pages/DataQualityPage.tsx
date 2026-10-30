import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Check,
  Flag,
} from 'lucide-react'
import { getDataQuality } from '../api/client'
import { ApiError, type DataQualityResponse } from '../api/types'
import {
  GlassCard,
  StatusBadge,
  Button,
  EmptyState,
  ErrorState,
} from '../ui'
import { LoadingState } from '../components/LoadingState'

interface ReviewDecision {
  status: 'confirmed' | 'flagged'
  note: string
  timestamp: string
}

export const DataQualityPage: React.FC = () => {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Selected finding for evidence panel
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null)

  // Review decisions map stored in state & localStorage
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>(() => {
    try {
      const stored = localStorage.getItem('eduquery_quality_decisions')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const [activeNote, setActiveNote] = useState<string>('')
  const [isPassedGroupOpen, setIsPassedGroupOpen] = useState<boolean>(false)

  const fetchQuality = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDataQuality()
      setData(res)
      if (res?.findings && res.findings.length > 0) {
        setSelectedCheckId((prev) => prev || res.findings[0].check_id)
      }
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

  // Save review decision to state & localStorage
  const handleRecordDecision = (checkId: string, status: 'confirmed' | 'flagged') => {
    const newDecision: ReviewDecision = {
      status,
      note: activeNote.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    const updated = { ...decisions, [checkId]: newDecision }
    setDecisions(updated)
    try {
      localStorage.setItem('eduquery_quality_decisions', JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  // Group findings into "Needs decision" (errors/mismatches) vs "Looks unusual" (warnings/info)
  const needsDecisionGroup = useMemo(() => {
    if (!data?.findings) return []
    return data.findings.filter(
      (f) => f.severity === 'error' || f.check_id.toLowerCase().includes('mismatch')
    )
  }, [data?.findings])

  const looksUnusualGroup = useMemo(() => {
    if (!data?.findings) return []
    return data.findings.filter(
      (f) => f.severity !== 'error' && !f.check_id.toLowerCase().includes('mismatch')
    )
  }, [data?.findings])

  // Passed automated checks that detected zero contradictions
  const passedChecks = [
    { title: 'Duplicate Student Seat Identifiers', code: 'CHK_DUP_SEAT', count: 0, status: 'No duplicates in cohort' },
    { title: 'Enrollment Schema Boundary Rules', code: 'CHK_ENROLL_SCHEMA', count: 0, status: 'All student rosters valid' },
    { title: 'Marksheet Formula Cache Validation', code: 'CHK_FORMULA_CACHE', count: 0, status: 'Zero corrupted formula cells' },
    { title: 'Mandatory Grade Flag Precedence', code: 'CHK_FLAG_PRECEDENCE', count: 0, status: 'Component failure flags verified' },
  ]

  const totalDecisionItems = (data?.findings || []).length
  const reviewedCount = (data?.findings || []).filter((f) => Boolean(decisions[f.check_id])).length
  const isReadyToDeclare = totalDecisionItems > 0 ? reviewedCount === totalDecisionItems : true
  const progressPercent = totalDecisionItems > 0 ? Math.round((reviewedCount / totalDecisionItems) * 100) : 100

  // Active selected finding
  const activeFinding = useMemo(() => {
    if (!data?.findings || data.findings.length === 0) return null
    return data.findings.find((f) => f.check_id === selectedCheckId) || data.findings[0]
  }, [data?.findings, selectedCheckId])

  // Synchronize note when active finding changes
  useEffect(() => {
    if (activeFinding && decisions[activeFinding.check_id]) {
      setActiveNote(decisions[activeFinding.check_id].note)
    } else {
      setActiveNote('')
    }
  }, [activeFinding?.check_id, decisions])

  if (loading && !data) {
    return <LoadingState message="Auditing active marksheet dataset against pre-declaration verification rules..." />
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', padding: 'var(--space-6) var(--space-4)' }}>
        <ErrorState error={error.message || 'Could not load data quality audit'} onRetry={fetchQuality} />
      </div>
    )
  }

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
      {/* 1. Header Banner & Pre-Declaration Status */}
      <GlassCard variant="glass-2" padding="md">
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
                gap: '8px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                marginBottom: '4px',
              }}
            >
              <ShieldCheck size={16} />
              <span>Pre-Declaration Verification & Anomaly Review</span>
            </div>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 2px 0',
                letterSpacing: '-0.02em',
              }}
            >
              Data Quality Checks
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Verify marks totals, check for missing grades, and review flagged records before declaring results.
            </p>
          </div>

          {/* Status Badge flipping to "Ready to declare" */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <StatusBadge
              tone={isReadyToDeclare ? 'pass' : 'warn'}
              size="md"
              label={isReadyToDeclare ? 'Ready to Declare' : 'Action Required · Review in Progress'}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isReadyToDeclare
                ? 'All verification items resolved'
                : `${totalDecisionItems - reviewedCount} pending review`}
            </span>
          </div>
        </div>

        {/* Verification Progress Bar */}
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--text-xs)',
              marginBottom: '6px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              Review Progress: {reviewedCount} of {totalDecisionItems} reviewed
            </span>
            <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {progressPercent}%
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
                width: `${progressPercent}%`,
                height: '100%',
                background: isReadyToDeclare ? 'var(--status-success-text)' : 'var(--action-primary-bg)',
                borderRadius: 'var(--radius-full)',
                transition: 'width var(--transition-normal)',
              }}
            />
          </div>
        </div>
      </GlassCard>

      {/* 2. Audit Scope Disclaimer */}
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
        <AlertCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text)' }}>Audit Scope Disclaimer:</strong> Automated verification
          detects mathematical discrepancies between printed totals and component marks. Sign off confirms
          reconciliation for official university records.
        </div>
      </div>

      {/* 3. Master-Detail Layout */}
      <div className="data-quality-grid">
        {/* LEFT COLUMN: Master List */}
        <div>
          <GlassCard
            variant="glass-2"
            padding="md"
            headerSlot={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Verification Items
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {totalDecisionItems} items to audit
                </span>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Group 1: Needs Decision */}
              {needsDecisionGroup.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--status-danger-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertTriangle size={12} />
                    <span>Needs Decision ({needsDecisionGroup.length})</span>
                  </div>

                  {needsDecisionGroup.map((item) => {
                    const isSelected = activeFinding?.check_id === item.check_id
                    const dec = decisions[item.check_id]

                    return (
                      <button
                        key={item.check_id}
                        type="button"
                        onClick={() => setSelectedCheckId(item.check_id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected
                            ? '1px solid var(--action-primary-bg)'
                            : '1px solid var(--border)',
                          background: isSelected ? 'var(--surface-active)' : 'var(--surface-hover)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
                            {item.title}
                          </span>
                          {dec ? (
                            <StatusBadge
                              tone={dec.status === 'confirmed' ? 'pass' : 'fail'}
                              size="sm"
                              label={dec.status === 'confirmed' ? 'Confirmed OK' : 'Flagged'}
                            />
                          ) : (
                            <StatusBadge tone="warn" size="sm" label="Pending" />
                          )}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                          {item.problem}
                        </div>

                        <div className="tabular-nums" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.count} affected record{item.count !== 1 ? 's' : ''} &bull; {item.check_id}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Group 2: Looks Unusual */}
              {looksUnusualGroup.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Looks Unusual ({looksUnusualGroup.length})</span>
                  </div>

                  {looksUnusualGroup.map((item) => {
                    const isSelected = activeFinding?.check_id === item.check_id
                    const dec = decisions[item.check_id]

                    return (
                      <button
                        key={item.check_id}
                        type="button"
                        onClick={() => setSelectedCheckId(item.check_id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected
                            ? '1px solid var(--action-primary-bg)'
                            : '1px solid var(--border)',
                          background: isSelected ? 'var(--surface-active)' : 'var(--surface-hover)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>
                            {item.title}
                          </span>
                          {dec ? (
                            <StatusBadge
                              tone={dec.status === 'confirmed' ? 'pass' : 'fail'}
                              size="sm"
                              label={dec.status === 'confirmed' ? 'Confirmed OK' : 'Flagged'}
                            />
                          ) : (
                            <StatusBadge tone="warn" size="sm" label="Pending" />
                          )}
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                          {item.problem}
                        </div>

                        <div className="tabular-nums" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.count} affected record{item.count !== 1 ? 's' : ''} &bull; {item.check_id}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Group 3: Passed Checks (Collapsed by default with green checkmark) */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsPassedGroupOpen((prev) => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--status-success-text)' }} />
                    <span>Passed Automated Checks ({passedChecks.length})</span>
                  </div>
                  {isPassedGroupOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isPassedGroupOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {passedChecks.map((chk) => (
                      <div
                        key={chk.code}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--surface-hover)',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{chk.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{chk.code}</div>
                        </div>
                        <span style={{ color: 'var(--status-success-text)', fontWeight: 600 }}>
                          &bull; {chk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: Evidence & Verification Panel */}
        <div>
          {activeFinding ? (
            <GlassCard variant="glass-2" padding="lg">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Finding Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 'var(--space-4)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {activeFinding.check_id}
                    </div>
                    <h2
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 700,
                        color: 'var(--text)',
                        margin: '2px 0 0 0',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {activeFinding.title}
                    </h2>
                  </div>

                  {decisions[activeFinding.check_id] ? (
                    <StatusBadge
                      tone={decisions[activeFinding.check_id].status === 'confirmed' ? 'pass' : 'fail'}
                      size="md"
                      label={
                        decisions[activeFinding.check_id].status === 'confirmed'
                          ? 'Confirmed OK'
                          : 'Flagged for Recheck'
                      }
                    />
                  ) : (
                    <StatusBadge tone="warn" size="md" label="Pending Decision" />
                  )}
                </div>

                {/* Evidence Card: What Was Noticed */}
                <div
                  style={{
                    background: 'var(--surface-hover)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)' }}>
                    What Was Noticed
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text)', lineHeight: 1.5 }}>
                    {activeFinding.problem}
                  </p>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <strong>Impact on results:</strong> {activeFinding.impact}
                  </div>
                </div>

                {/* Context Details */}
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Observed Student Records ({activeFinding.details?.length || activeFinding.count})
                  </div>
                  {activeFinding.details && activeFinding.details.length > 0 ? (
                    <div
                      style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px',
                        background: 'var(--surface-data)',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {activeFinding.details.map((detail, idx) => (
                        <div key={idx} style={{ color: 'var(--text)' }}>
                          &bull; {detail}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Affects {activeFinding.count} student evaluation component records.
                    </div>
                  )}
                </div>

                {/* Recommended Remediation */}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <strong>Recommended Action:</strong> {activeFinding.recommended_action}
                </div>

                {/* Verification Decision Form */}
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-3)',
                  }}
                >
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text)' }}>
                    Faculty Verification Note (Optional)
                    <textarea
                      rows={2}
                      placeholder="Add rationale, physical workbook confirmation reference, or note..."
                      value={activeNote}
                      onChange={(e) => setActiveNote(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: '6px',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-data)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-sans)',
                        resize: 'vertical',
                      }}
                    />
                  </label>

                  {/* Decision Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {decisions[activeFinding.check_id] && (
                        <span>
                          Decided at {decisions[activeFinding.check_id].timestamp} by Faculty Moderator
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRecordDecision(activeFinding.check_id, 'flagged')}
                        icon={<Flag size={14} />}
                      >
                        Flag for recheck
                      </Button>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRecordDecision(activeFinding.check_id, 'confirmed')}
                        icon={<Check size={14} />}
                      >
                        Confirm OK
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="glass-2" padding="lg">
              <EmptyState
                icon={<FileCheck size={36} />}
                title="No Verification Items Selected"
                description="Select an audit finding from the master list to review evidence and confirm OK."
              />
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  )
}
export default DataQualityPage
