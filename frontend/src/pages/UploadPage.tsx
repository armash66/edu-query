import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
  Trash2,
  Info,
} from 'lucide-react'
import { useSession } from '../context/SessionContext'
import { useHealth } from '../context/HealthContext'
import { ApiError } from '../api/client'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MiB

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    session,
    preview,
    hasActiveSession,
    isPreviewReady,
    uploadMarksheet,
    confirmSession,
    deleteSession,
    saveSession,
    clearPreview,
  } = useSession()
  const { refreshHealth } = useHealth()

  const [dragActive, setDragActive] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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
    // Reset target value so choosing the same file triggers onChange
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

  return (
    <div
      style={{
        maxWidth: '840px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      {/* Header Banner */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-1)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Academic Marksheet Analysis
          </div>
          {hasActiveSession && <StatusBadge tone="pass" size="sm" label="Active Cohort Loaded" />}
        </div>
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 var(--space-1) 0',
            letterSpacing: '-0.02em',
          }}
        >
          Analyze a marksheet
        </h1>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Upload an Excel marksheet (.xlsx) to review cohort outcomes, subject failure rates, and
          records requiring faculty verification.
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

      {/* Preview Card (Shown after successful upload) */}
      {isPreviewReady && preview ? (
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
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  border: '1px solid var(--status-success-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)' }}>
                  Marksheet Structure Detected
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {session?.filename || selectedFile?.name} &bull; Ready for confirmation
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancelPreview}
              icon={<Trash2 size={14} />}
            >
              Cancel
            </Button>
          </div>

          {/* Metric Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-4)',
              background: 'var(--surface-hover)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <div>
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
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {preview.detected_students ?? session?.students_count ?? 0}
              </div>
            </div>

            <div>
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
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {preview.detected_subjects ?? session?.courses_count ?? 0}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Divisions
              </div>
              <div
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {preview.divisions && preview.divisions.length > 0
                  ? preview.divisions.join(', ')
                  : 'None / Whole Class'}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Detected Sheets
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {preview.sheets && preview.sheets.length > 0
                  ? preview.sheets.join(', ')
                  : 'Default Sheet'}
              </div>
            </div>
          </div>

          {/* Actionable Format Notes */}
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
                <Info size={14} /> Marksheet layout characteristics:
              </div>
              <ul style={{ margin: '0 0 0 var(--space-4)', padding: 0 }}>
                {preview.format_notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Privacy Retention Mode Selection */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)' }}>
                Select Retention Mode for this Analysis:
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Institutional persistence is strictly opt-in
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {/* Temporary Option */}
              <label
                htmlFor="retention-mode-temporary"
                className="glass-1"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  border:
                    privacyMode === 'temporary'
                      ? '2px solid var(--text)'
                      : '1px solid var(--border)',
                  background:
                    privacyMode === 'temporary'
                      ? 'var(--surface-active)'
                      : 'var(--surface-glass-1)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <input
                  id="retention-mode-temporary"
                  type="radio"
                  name="retentionMode"
                  value="temporary"
                  checked={privacyMode === 'temporary'}
                  onChange={() => setPrivacyMode('temporary')}
                  style={{ marginTop: '3px', accentColor: 'var(--text)' }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      Temporary Analysis
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--status-success-bg)',
                        color: 'var(--status-success-text)',
                        border: '1px solid var(--status-success-border)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Default &bull; Zero Persistence
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    Stored in an isolated temporary DuckDB workspace (/tmp). Raw .xlsx file is unlinked immediately.
                    Erased automatically after 1 hour (3,600s), or instantly when clicking &quot;Delete session and data&quot;.
                  </div>
                </div>
              </label>

              {/* Persistent Option */}
              <label
                htmlFor="retention-mode-persistent"
                className="glass-1"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  border:
                    privacyMode === 'persistent'
                      ? '2px solid var(--text)'
                      : '1px solid var(--border)',
                  background:
                    privacyMode === 'persistent'
                      ? 'var(--surface-active)'
                      : 'var(--surface-glass-1)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <input
                  id="retention-mode-persistent"
                  type="radio"
                  name="retentionMode"
                  value="persistent"
                  checked={privacyMode === 'persistent'}
                  onChange={() => setPrivacyMode('persistent')}
                  style={{ marginTop: '3px', accentColor: 'var(--text)' }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      Save to Institutional Storage
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--surface-hover)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Opt-In Storage
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    Promotes the parsed DuckDB database to institutional storage (/app/data/datasets/).
                    Retained indefinitely across sessions and container restarts. Deletable and mutable only by authenticated administrators.
                  </div>
                </div>
              </label>
            </div>

            {privacyMode === 'persistent' && (
              <div
                style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                <label
                  htmlFor="save-dataset-name-input"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  Institutional Dataset Label (Optional)
                </label>
                <input
                  id="save-dataset-name-input"
                  type="text"
                  value={saveDatasetName}
                  onChange={(e) => setSaveDatasetName(e.target.value)}
                  placeholder="e.g. Sem 4 Examination - May 2026"
                  className="data-surface"
                  style={{
                    width: '100%',
                    maxWidth: '380px',
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  A descriptive name helps faculty locate this cohort in institutional reports.
                </div>
              </div>
            )}
          </div>

          {/* Validation Diagnostics Panels */}
          {(() => {
            const hasBlockingErrors = Boolean(
              session?.can_confirm === false ||
                (session?.blocking_errors && session.blocking_errors.length > 0)
            )
            const rawFindings = preview.findings || []
            const warningFindings = rawFindings.filter((f) => f.severity === 'warning')
            const infoFindings = rawFindings.filter((f) => f.severity === 'info')

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* 1. Blocking Errors */}
                {hasBlockingErrors && (
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
                      The following critical validation errors must be resolved before cohort
                      analysis can begin:
                    </div>

                    <ul
                      style={{
                        margin: '0 0 0 var(--space-4)',
                        padding: 0,
                        lineHeight: 1.5,
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      {session?.blocking_errors && session.blocking_errors.length > 0 ? (
                        session.blocking_errors.map((err, idx) => (
                          <li key={idx} style={{ fontWeight: 500 }}>
                            {err}
                          </li>
                        ))
                      ) : (
                        <li>Workbook failed data quality gates and cannot be activated safely.</li>
                      )}
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
                        Correct the flagged marks or identifiers in your original spreadsheet, then
                        click &quot;Choose different file&quot; below to upload the corrected
                        workbook.
                      </span>
                    </div>
                  </GlassCard>
                )}

                {/* 2. Validation Warnings (Non-Blocking Data Quality Notice) */}
                {warningFindings.length > 0 && (
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
                        <AlertTriangle size={16} />
                        <span>
                          Data Quality Notice ({warningFindings.length} advisory issue
                          {warningFindings.length > 1 ? 's' : ''}) &bull; Analysis Permitted
                        </span>
                      </div>
                      <StatusBadge tone="warn" size="sm" label="Review Advised" />
                    </div>

                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
                    >
                      {warningFindings.map((f, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--surface-card)',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--status-warning-border)',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: 'var(--text)',
                              fontSize: 'var(--text-xs)',
                              marginBottom: '2px',
                            }}
                          >
                            {f.title}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.45,
                            }}
                          >
                            &quot;{f.problem}&quot;
                          </div>
                          {f.details && f.details.length > 0 && (
                            <details
                              style={{
                                marginTop: 'var(--space-1)',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                View issue details ({f.details.length} sample entries)
                              </summary>
                              <ul style={{ margin: 'var(--space-1) 0 0 var(--space-4)', padding: 0 }}>
                                {f.details.map((d, dIdx) => (
                                  <li key={dIdx}>{d}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--status-warning-text)' }}>
                      You can proceed to explore the cohort. These warnings will remain accessible
                      in the Data Quality tab.
                    </div>
                  </GlassCard>
                )}

                {/* 3. Informational Notes & Verified Extended-Scale */}
                {infoFindings.length > 0 && (
                  <GlassCard
                    variant="glass-1"
                    padding="sm"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        color: 'var(--text)',
                      }}
                    >
                      <Info size={14} />
                      <span>Curriculum & Assessment Characteristics:</span>
                    </div>
                    <ul style={{ margin: '0 0 0 var(--space-4)', padding: 0, lineHeight: 1.45 }}>
                      {infoFindings.map((f, idx) => (
                        <li key={idx}>
                          <strong>{f.title}:</strong> {f.problem}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                )}
              </div>
            )
          })()}

          {/* Confirmation Action Buttons */}
          {(() => {
            const isActivationBlocked = Boolean(
              session?.can_confirm === false ||
                (session?.blocking_errors && session.blocking_errors.length > 0)
            )

            return (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 'var(--space-3)',
                  }}
                >
                  <Button
                    variant="secondary"
                    onClick={handleCancelPreview}
                    disabled={confirming}
                  >
                    Choose different file
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirm}
                    disabled={confirming || isActivationBlocked}
                    loading={confirming}
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                    title={
                      isActivationBlocked
                        ? 'Resolve blocking validation errors before activating'
                        : undefined
                    }
                  >
                    Confirm & Start Analysis
                  </Button>
                </div>
                {isActivationBlocked && (
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--status-danger-text)',
                      fontWeight: 500,
                    }}
                  >
                    Activation is blocked due to critical validation errors above. Please correct
                    the workbook to continue.
                  </div>
                )}
              </div>
            )
          })()}
        </GlassCard>
      ) : (
        /* Upload Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!uploading) {
                fileInputRef.current?.click()
              }
            }}
            className="glass-2"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-12) var(--space-6)',
              borderRadius: 'var(--radius-card)',
              border: dragActive
                ? '2px dashed var(--text)'
                : '2px dashed var(--border-strong)',
              background: dragActive ? 'var(--surface-active)' : 'var(--surface-glass-2)',
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'all var(--transition-fast)',
              textAlign: 'center',
              boxShadow: dragActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />

            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                marginBottom: 'var(--space-4)',
                border: '1px solid var(--border)',
              }}
            >
              {uploading ? (
                <svg
                  style={{
                    width: '28px',
                    height: '28px',
                    animation: 'spin 1s linear infinite',
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="40 60"
                  />
                </svg>
              ) : (
                <UploadCloud size={30} />
              )}
            </div>

            <div
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 'var(--space-1)',
              }}
            >
              {uploading
                ? 'Processing and validating marksheet...'
                : 'Drop your Excel marksheet here, or browse'}
            </div>

            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                maxWidth: '420px',
                lineHeight: 1.5,
              }}
            >
              Supports Microsoft Excel OpenXML (.xlsx) up to 25 MiB.
              <br />
              Headers and multi-row formats are automatically detected.
            </div>

            {!uploading && (
              <Button
                variant="primary"
                size="sm"
                style={{ marginTop: '24px', pointerEvents: 'none' }}
              >
                Browse file
              </Button>
            )}
          </div>

          {/* Privacy Statement Card */}
          <GlassCard
            variant="glass-1"
            padding="md"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              <ShieldCheck size={18} />
              <span>Privacy & Data Handling</span>
            </div>

            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Uploaded Excel workbooks are processed on the server and immediately deleted from disk after
              ingestion into an isolated temporary DuckDB workspace. Data is never shared or retained beyond
              your session lifetime.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-3)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <Lock
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>Isolated temporary workspace:</strong> Raw .xlsx files are unlinked from disk immediately
                  after parsing. Only relational tables in an isolated session DuckDB are retained.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <Trash2
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>Instant full deletion:</strong> Sessions automatically expire and purge after 1 hour (3,600s),
                  or instantly when clicking &quot;Delete session and data&quot;.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <Database
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>Deterministic Processing:</strong> Zero external AI/LLM APIs. Classification, reconciliation,
                  and anomaly detection run entirely deterministically within your container.
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}

export default UploadPage
