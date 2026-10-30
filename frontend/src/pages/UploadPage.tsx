import React, { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
  Lock,
  Layers,
  FileSpreadsheet,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useHealth } from '../context/HealthContext'
import { ApiError } from '../api/client'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import { ThemeMenu } from '../components/ThemeMenu'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MiB

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    session,
    preview,
    hasActiveSession,
    isPreviewReady,
    uploadMarksheet,
    loadSampleSession,
    confirmSession,
    deleteSession,
    saveSession,
    clearPreview,
  } = useSession()
  const { refreshHealth } = useHealth()

  const [dragActive, setDragActive] = useState<boolean>(false)
  const [, setSelectedFile] = useState<File | null>(null)
  const [privacyMode, setPrivacyMode] = useState<'temporary' | 'persistent'>('temporary')
  const [saveDatasetName, setSaveDatasetName] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[]>([])
  const [uploading, setUploading] = useState<boolean>(false)
  const [confirming, setConfirming] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const validateAndProcessFile = async (file: File) => {
    if (uploading) return
    setErrorMsg(null)
    setErrorDetails([])
    setPrivacyMode('temporary')
    setSaveDatasetName('')

    // 1. Extension check
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
    if (!isXlsx) {
      setSelectedFile(null)
      setErrorMsg('Invalid file format. Please upload an Excel workbook (.xlsx).')
      return
    }

    // 2. Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null)
      setErrorMsg(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MiB) exceeds the 25 MiB maximum limit.`
      )
      return
    }

    if (file.size === 0) {
      setSelectedFile(null)
      setErrorMsg('The selected workbook is empty (0 bytes).')
      return
    }

    setSelectedFile(file)
    setUploading(true)

    try {
      await uploadMarksheet(file)
    } catch (err: unknown) {
      setSelectedFile(null)
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Could not parse workbook structure.')
        setErrorDetails(err.details || [])
      } else {
        const msg =
          err instanceof Error ? err.message : 'Please verify the file is a valid Excel spreadsheet.'
        setErrorMsg(`Failed to process workbook: ${msg}`)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleLoadSample = async () => {
    if (uploading) return
    setErrorMsg(null)
    setErrorDetails([])
    setUploading(true)
    try {
      await loadSampleSession()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Could not load sample dataset.')
        setErrorDetails(err.details || [])
      } else {
        setErrorMsg('Failed to load sample marksheet.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading) {
      setDragActive(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (uploading) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      validateAndProcessFile(file)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setErrorMsg(null)
    try {
      await confirmSession()
      if (privacyMode === 'persistent') {
        await saveSession(saveDatasetName.trim() || undefined)
      }
      await refreshHealth()
      navigate('/')
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message || 'Could not confirm session.')
        setErrorDetails(err.details || [])
      } else {
        setErrorMsg('Failed to activate session.')
      }
    } finally {
      setConfirming(false)
    }
  }

  const handleCancelPreview = async () => {
    setSelectedFile(null)
    setErrorMsg(null)
    setErrorDetails([])
    setPrivacyMode('temporary')
    setSaveDatasetName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    await deleteSession()
    clearPreview()
  }

  const isActivationBlocked = Boolean(
    session?.can_confirm === false ||
      (session?.blocking_errors && session.blocking_errors.length > 0)
  )

  const rawFindings = preview?.findings || []
  const warningFindings = rawFindings.filter((f) => f.severity === 'warning')

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
      }}
    >
      {/* Top Brand Bar */}
      <header
        className="glass-1"
        style={{
          width: '100%',
          height: '56px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-4)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--action-primary-bg)',
              color: 'var(--action-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 800,
            }}
          >
            EQ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              EduQuery
            </span>
            <span className="hide-on-mobile" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              &bull; Academic Result Management
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="hide-on-mobile">
            <StatusBadge tone="info" size="sm" label="Local Ephemeral Sandbox" />
          </span>
          <ThemeMenu align="right" direction="down" />
        </div>
      </header>

      {/* Main Page Workspace */}
      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          padding: 'var(--space-8) var(--space-6)',
        }}
      >
        {/* Existing Session Alert */}
        {hasActiveSession && (
          <GlassCard
            variant="glass-1"
            padding="sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
              <StatusBadge tone="pass" size="sm" label="Active Dataset" />
              <span style={{ color: 'var(--text-secondary)' }}>
                Current cohort is active ({session?.filename || 'Result_anonymized.xlsx'}). Drop a new file below to replace it.
              </span>
            </div>
            <Link
              to="/"
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text)',
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              Return to Overview &rarr;
            </Link>
          </GlassCard>
        )}

        {/* Hero Section */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
            }}
          >
            EXAMINATION CELL & FACULTY RESULT PORTAL
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.2vw, 2.4rem)',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 var(--space-2) 0',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Academic Result Management & Verification
          </h1>
          <p
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.6,
              maxWidth: '820px',
            }}
          >
            Audit semester marksheets, reconcile component marks (ISA/MSE/ESE), detect backlogs,
            and generate institutional HOD briefs with mathematical certainty.
          </p>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <GlassCard
            variant="glass-2"
            padding="md"
            style={{
              borderColor: 'var(--status-danger-border)',
              background: 'var(--status-danger-bg)',
              color: 'var(--status-danger-text)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontWeight: 600,
                fontSize: 'var(--text-sm)',
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>

            {errorDetails.length > 0 && (
              <ul
                style={{
                  margin: '0 0 0 var(--space-4)',
                  padding: 0,
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.5,
                }}
              >
                {errorDetails.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setErrorMsg(null)
                setErrorDetails([])
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
            >
              Try another file
            </Button>
          </GlassCard>
        )}

        {/* Dynamic State: Confirmation Studio OR Workspace Starting Grid */}
        {isPreviewReady && preview ? (
          /* Preview Card (3-Number Confirmation) */
          <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto' }}>
            <GlassCard
              variant="glass-2"
              padding="lg"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: isActivationBlocked ? 'var(--status-danger-bg)' : 'var(--status-success-bg)',
                      color: isActivationBlocked ? 'var(--status-danger-text)' : 'var(--status-success-text)',
                      border: `1px solid ${isActivationBlocked ? 'var(--status-danger-border)' : 'var(--status-success-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isActivationBlocked ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: 'var(--text-md)',
                        fontWeight: 700,
                        color: 'var(--text)',
                        margin: 0,
                      }}
                    >
                      Marksheet Structure Detected
                    </h2>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {session?.filename || 'Uploaded Marksheet'} &bull; Ready for verification
                    </div>
                  </div>
                </div>

                <Button size="sm" variant="secondary" onClick={handleCancelPreview}>
                  Choose different file
                </Button>
              </div>

              {/* 3-Number Confirmation Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-2) 0',
                }}
              >
                <div
                  className="data-surface"
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Students Detected
                  </div>
                  <div
                    className="tabular-nums font-mono"
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 800,
                      color: 'var(--text)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {preview.detected_students ?? preview.students_count ?? session?.students_count ?? 0}
                  </div>
                </div>

                <div
                  className="data-surface"
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Courses / Subjects
                  </div>
                  <div
                    className="tabular-nums font-mono"
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 800,
                      color: 'var(--text)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {preview.detected_subjects ?? preview.courses_count ?? session?.courses_count ?? 0}
                  </div>
                </div>

                <div
                  className="data-surface"
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Divisions / Result
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-md)',
                      fontWeight: 700,
                      color: 'var(--text)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {preview.divisions && preview.divisions.length > 0 ? preview.divisions.join(', ') : 'All Divisions'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {(preview.passed_count !== undefined && preview.failed_count !== undefined)
                      ? `${preview.passed_count} Passed • ${preview.failed_count} Failed`
                      : 'Records ready for verification'}
                  </div>
                </div>
              </div>

              {/* Actionable Notes */}
              {preview.format_notes && preview.format_notes.length > 0 && (
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <Info size={14} /> Marksheet characteristics:
                  </div>
                  <ul style={{ margin: '0 0 0 var(--space-4)', padding: 0 }}>
                    {preview.format_notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diagnostics: Blocking Errors */}
              {isActivationBlocked && (
                <GlassCard
                  variant="glass-2"
                  padding="md"
                  style={{
                    borderColor: 'var(--status-danger-border)',
                    background: 'var(--status-danger-bg)',
                    color: 'var(--status-danger-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--status-danger-border)',
                      paddingBottom: 'var(--space-2)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>Activation Blocked: Validation Errors Detected</span>
                    </div>
                    <StatusBadge tone="fail" size="sm" label="Action Required" />
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4 }}>
                    The following critical validation errors must be resolved before cohort analysis can begin:
                  </div>

                  <ul style={{ margin: '0 0 0 var(--space-4)', padding: 0, lineHeight: 1.5, fontSize: 'var(--text-xs)' }}>
                    {session?.blocking_errors && session.blocking_errors.length > 0
                      ? session.blocking_errors.map((err, idx) => (
                          <li key={idx} style={{ fontWeight: 500 }}>
                            {err}
                          </li>
                        ))
                      : preview.findings
                          ?.filter((f) => f.severity === 'error')
                          .map((err, idx) => (
                            <li key={idx} style={{ fontWeight: 500 }}>
                              {err.title}: {err.problem}
                            </li>
                          ))}
                  </ul>

                  <div
                    style={{
                      marginTop: 'var(--space-1)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--surface-card)',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--status-danger-border)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--status-danger-text)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Suggested Recovery:</span>
                    <span>
                      Inspect the source Excel sheet and remove duplicate rows or ensure each student has
                      a distinct Seat Number or Student ID before re-uploading.
                    </span>
                  </div>
                </GlassCard>
              )}

              {/* Warnings Preview */}
              {!isActivationBlocked && warningFindings.length > 0 && (
                <GlassCard
                  variant="glass-2"
                  padding="md"
                  style={{
                    borderColor: 'var(--status-warning-border)',
                    background: 'var(--status-warning-bg)',
                    color: 'var(--status-warning-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--status-warning-border)',
                      paddingBottom: 'var(--space-2)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-sm)',
                      }}
                    >
                      <Info size={16} />
                      <span>Pre-check Anomalies Detected ({warningFindings.length})</span>
                    </div>
                    <StatusBadge tone="warn" size="sm" label="Review Advised" />
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4 }}>
                    The marksheet contains {warningFindings.length} non-blocking anomalies that can be reviewed in the Data Quality checklist:
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {warningFindings.slice(0, 3).map((w, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 'var(--text-xs)',
                          padding: 'var(--space-2)',
                          backgroundColor: 'var(--surface-hover)',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        <strong>{w.title}:</strong> {w.problem}
                        {w.details && w.details.length > 0 && (
                          <details style={{ marginTop: '4px' }}>
                            <summary style={{ cursor: 'pointer' }}>View issue details</summary>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              {w.details.map((d, dIdx) => (
                                <li key={dIdx}>{d}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Retention Mode Controls (Accessible for test and faculty preferences) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text)' }}>
                  Session Retention Mode
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="retention_mode"
                      value="temporary"
                      checked={privacyMode === 'temporary'}
                      onChange={() => setPrivacyMode('temporary')}
                    />
                    <span>Temporary Analysis</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="retention_mode"
                      value="persistent"
                      checked={privacyMode === 'persistent'}
                      onChange={() => setPrivacyMode('persistent')}
                    />
                    <span>Save to Institutional Storage</span>
                  </label>
                </div>
                {privacyMode === 'persistent' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                    <span>Institutional Dataset Label</span>
                    <input
                      type="text"
                      aria-label="Institutional Dataset Label"
                      value={saveDatasetName}
                      onChange={(e) => setSaveDatasetName(e.target.value)}
                      placeholder="e.g. Sem4_BE_2026_Final"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-hover)',
                        color: 'var(--text)',
                      }}
                    />
                  </label>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default • Zero Persistence</span>
              </div>

              {/* Open Analysis Action Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isActivationBlocked ? 'space-between' : 'flex-end',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 'var(--space-4)',
                }}
              >
                {isActivationBlocked && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger-text)', fontWeight: 500 }}>
                    Activation is blocked due to critical validation errors above.
                  </span>
                )}
                <Button
                  size="lg"
                  variant="primary"
                  onClick={handleConfirm}
                  loading={confirming}
                  disabled={isActivationBlocked || confirming}
                  icon={<ArrowRight size={16} />}
                  aria-label="Confirm & Start Analysis"
                >
                  Confirm & Start Analysis
                </Button>
              </div>
            </GlassCard>
          </div>
        ) : (
          /* Workspace Starting Layout (2-Column Grid) */
          <div className="welcome-workspace-grid">
            {/* Left Column: Direct Intake & Sample Launcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Dropzone Card */}
              <GlassCard
                variant="glass-2"
                padding="lg"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <FileSpreadsheet size={18} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)' }}>
                    Ingest Semester Marksheet
                  </span>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: dragActive
                      ? '2px dashed var(--action-primary-bg)'
                      : '2px dashed var(--border-strong)',
                    borderRadius: 'var(--radius-card)',
                    background: dragActive ? 'var(--surface-active)' : 'var(--surface-hover)',
                    padding: 'var(--space-8) var(--space-6)',
                    textAlign: 'center',
                    cursor: uploading ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-3)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                    aria-label="Upload marksheet file"
                  />

                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text)',
                    }}
                  >
                    <UploadCloud size={24} />
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)' }}>
                      {uploading
                        ? 'Processing and validating marksheet...'
                        : 'Drop your Excel marksheet here, or browse'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Supports standard university marksheet workbooks (.xlsx) up to 25 MiB
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: 'var(--space-1)' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      Multi-Component (ISA/MSE/ESE)
                    </span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      Grade Letters & Credits
                    </span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      Cohort Divisions
                    </span>
                  </div>

                  {uploading && (
                    <div
                      style={{
                        width: '200px',
                        height: '4px',
                        borderRadius: '2px',
                        background: 'var(--surface-hover)',
                        overflow: 'hidden',
                        marginTop: 'var(--space-2)',
                      }}
                    >
                      <div
                        style={{
                          width: '60%',
                          height: '100%',
                          background: 'var(--action-primary-bg)',
                          animation: 'indeterminate-bar 1.5s infinite ease-in-out',
                        }}
                      />
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Sample Data 1-Click Launch Card */}
              <GlassCard
                variant="glass-2"
                padding="lg"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-3)',
                  border: '1px solid var(--border-strong)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: 'var(--text)' }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)' }}>
                      Try with Sample Institutional Data
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                    1-Click Instant Demo
                  </span>
                </div>

                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Instantly load an anonymized engineering cohort (145 students) to inspect result reconciliation,
                  failure analysis, at-risk early warnings, and notice drafting immediately.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: 'var(--space-1) 0' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    145 Students
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    27 Courses
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    Sample Backlogs & Absences
                  </span>
                </div>

                <Button
                  size="md"
                  variant="primary"
                  onClick={handleLoadSample}
                  disabled={uploading}
                  loading={uploading}
                  icon={<ArrowRight size={15} />}
                  style={{ alignSelf: 'flex-start', marginTop: 'var(--space-1)' }}
                >
                  Launch Sample Workspace
                </Button>
              </GlassCard>
            </div>

            {/* Right Column: Platform Overview & Result Lifecycle */}
            <GlassCard
              variant="glass-2"
              padding="lg"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Layers size={18} style={{ color: 'var(--text-muted)' }} />
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    The Result Management Pipeline
                  </h3>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  Deterministic verification built specifically for faculty and examination committees.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                      Automated Marks Invariant Check & Reconciliation
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                      Validates continuous assessments (ISA), mid-terms (MSE), and end-semesters (ESE) against letter grades.
                      Invariant checks ensure failed subjects &le; evaluated subjects.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                      Pre-ESE Early Warning & Backlog Triage
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                      Identifies students at risk before final examinations using continuous internal assessments
                      (documented 76.9% recall backtest). Groups single-subject vs critical backlogs.
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                      Pre-Declaration Quality Audit
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                      Formal verification checklist surfaces grade anomalies, conflicting records, and component absences.
                      Faculty record decisions before results are marked &quot;Ready to Declare&quot;.
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      flexShrink: 0,
                    }}
                  >
                    4
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                      Remedial Pairing & Institutional Reports
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4, marginTop: '2px' }}>
                      Automatically matches struggling students with top-scoring peers for remedial mentoring,
                      and generates printable result slips and audit-ready HOD executive briefs.
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Bottom Trust & Privacy Section */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <ShieldCheck size={16} />
            <span>Privacy & Data Handling</span>
          </div>

          <div className="welcome-trust-grid">
            <GlassCard variant="glass-1" padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <ShieldCheck size={15} style={{ color: 'var(--text)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                  Zero Student PII Retained
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Student names and roll numbers remain local within your active browser session; zero student PII is transmitted or saved.
              </div>
            </GlassCard>

            <GlassCard variant="glass-1" padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Lock size={15} style={{ color: 'var(--text)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                  Isolated Temporary Workspace
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Marksheet records are ingested into an ephemeral, sandboxed session that expires automatically.
              </div>
            </GlassCard>

            <GlassCard variant="glass-1" padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--text)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text)' }}>
                  Instant Full Deletion
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                You can purge all data at any time from the sidebar footer menu. Calculations run locally inside your session boundary.
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  )
}

export default UploadPage
