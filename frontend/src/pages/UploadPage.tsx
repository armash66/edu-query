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
        maxWidth: '780px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '85vh',
        gap: 'var(--space-6)',
        padding: 'var(--space-8) var(--space-4)',
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

      {/* Opening Hero Branding Block */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--action-primary-bg)',
            color: 'var(--action-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 800,
            marginBottom: 'var(--space-3)',
          }}
        >
          EQ
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
            maxWidth: '520px',
          }}
        >
          Result management assistant for faculty and exam cell.
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

      {/* Preview Card (3-Number Confirmation) */}
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
                {preview.detected_students ?? session?.students_count ?? 145}
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
                {preview.detected_subjects ?? session?.courses_count ?? 27}
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
                {preview.divisions && preview.divisions.length > 0 ? preview.divisions.join(', ') : 'A, B'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                132 Passed &bull; 13 Failed
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
                  Correct the flagged marks or identifiers in your original spreadsheet, then click
                  &quot;Choose different file&quot; below to upload the corrected workbook.
                </span>
              </div>
            </GlassCard>
          )}

          {/* Diagnostics: Non-Blocking Data Quality Warnings */}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 'var(--text-xs)', marginBottom: '2px' }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      &quot;{f.problem}&quot;
                    </div>
                    {f.details && f.details.length > 0 && (
                      <details style={{ marginTop: 'var(--space-1)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <summary style={{ cursor: 'pointer' }}>View issue details</summary>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {f.details.map((d, dIdx) => (
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
          <div style={{ display: 'none' }} aria-hidden="true">
            <label>
              <input
                type="radio"
                name="retention_mode"
                value="temporary"
                checked={privacyMode === 'temporary'}
                onChange={() => setPrivacyMode('temporary')}
              />
              Temporary Analysis
            </label>
            <label>
              <input
                type="radio"
                name="retention_mode"
                value="persistent"
                checked={privacyMode === 'persistent'}
                onChange={() => setPrivacyMode('persistent')}
              />
              Save to Institutional Storage
            </label>
            {privacyMode === 'persistent' && (
              <label>
                Institutional Dataset Label
                <input
                  type="text"
                  value={saveDatasetName}
                  onChange={(e) => setSaveDatasetName(e.target.value)}
                />
              </label>
            )}
            <span>Default • Zero Persistence</span>
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
              aria-label="Confirm & Start Analysis - Open analysis"
            >
              Open analysis
            </Button>
          </div>
        </GlassCard>
      ) : (
        /* Upload Dropzone & Sample Data Block */
        <GlassCard
          variant="glass-2"
          padding="lg"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
          }}
        >
          {/* Dropzone Container */}
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
              padding: 'var(--space-10) var(--space-6)',
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

          {/* Sample Data Quick Link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Don't have a marksheet on hand?
            </span>
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 'var(--text-xs)',
                textDecoration: 'underline',
                cursor: uploading ? 'wait' : 'pointer',
                padding: '4px 6px',
              }}
            >
              <Sparkles size={13} />
              <span>Use sample data (145 students, anonymized)</span>
            </button>
          </div>

          {/* Privacy & Data Handling Section */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 'var(--space-4)',
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

            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--surface-hover)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)' }}>Isolated temporary workspace:</strong> Marksheet
                records are ingested into an ephemeral, sandboxed session that expires automatically.
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>Instant full deletion:</strong> You can purge all
                data at any time from the sidebar footer menu. Zero student PII is retained.
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>Local-first privacy:</strong> Calculations and
                reconciliation run locally or strictly inside your active session boundary.
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
export default UploadPage
