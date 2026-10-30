import React, { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
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
      {/* Top Header — Clean Logo + Theme toggle only (No "Local Ephemeral Sandbox") */}
      <header
        className="glass-1"
        style={{
          width: '100%',
          height: '56px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-6)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--action-primary-bg)',
              color: 'var(--action-primary-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            EQ
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            EduQuery
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThemeMenu align="right" direction="down" />
        </div>
      </header>

      {/* Main Workspace — Calm, Centered Minimalism (Claude / GPT inspired) */}
      <main
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'var(--space-8) var(--space-4)',
          boxSizing: 'border-box',
        }}
      >
        {/* Active Session Alert if returning */}
        {hasActiveSession && !isPreviewReady && (
          <GlassCard
            variant="glass-1"
            padding="sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
              <StatusBadge tone="pass" size="sm" label="Active Dataset" />
              <span style={{ color: 'var(--text-secondary)' }}>
                {session?.filename || 'Result_anonymized.xlsx'} is currently loaded.
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
              marginBottom: 'var(--space-6)',
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

        {/* PREVIEW READY (File dropped/selected) */}
        {isPreviewReady && preview ? (
          <GlassCard
            variant="glass-2"
            padding="lg"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--status-success-text)' }} />
                <div>
                  <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Marksheet Structure Detected
                  </h2>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {session?.filename || 'Uploaded Marksheet'}
                  </div>
                </div>
              </div>

              <Button size="sm" variant="secondary" onClick={handleCancelPreview}>
                Choose different file
              </Button>
            </div>

            {/* 3 Stats Overview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-3)',
                textAlign: 'center',
              }}
            >
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Students
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                  {preview.detected_students ?? preview.students_count ?? session?.students_count ?? 0}
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Courses
                </div>
                <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                  {preview.detected_subjects ?? preview.courses_count ?? session?.courses_count ?? 0}
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-hover)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Divisions
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {preview.divisions && preview.divisions.length > 0 ? preview.divisions.join(', ') : 'All'}
                </div>
              </div>
            </div>

            {/* Non-blocking warnings */}
            {!isActivationBlocked && warningFindings.length > 0 && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                  {warningFindings[0]?.title || 'Data quality warning: Score entries need review'}
                </div>
                <div>{warningFindings[0]?.problem || 'Some entries fall outside the expected marks range.'}</div>
                {warningFindings[0]?.details && warningFindings[0].details.length > 0 && (
                  <details style={{ marginTop: '6px' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text)', fontWeight: 600 }}>View issue details</summary>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {warningFindings[0].details.map((d, dIdx) => (
                        <li key={dIdx}>{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Critical Blocking Errors */}
            {isActivationBlocked && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger-border)',
                  color: 'var(--status-danger-text)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  Activation Blocked: Validation Errors Detected
                </div>
                <div>
                  {session?.blocking_errors && session.blocking_errors.length > 0
                    ? session.blocking_errors.join(' ')
                    : 'Please check that each student row has a unique seat or student ID.'}
                </div>
                <div style={{ marginTop: '6px', fontWeight: 600 }}>Suggested Recovery:</div>
                <div>Inspect the source Excel sheet and remove duplicate rows or ensure distinct seat numbers.</div>
              </div>
            )}

            {/* Retention Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text)' }}>
                  <input
                    type="radio"
                    name="retention_mode"
                    value="temporary"
                    checked={privacyMode === 'temporary'}
                    onChange={() => setPrivacyMode('temporary')}
                  />
                  <span>Temporary Analysis</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
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
                <input
                  type="text"
                  aria-label="Institutional Dataset Label"
                  value={saveDatasetName}
                  onChange={(e) => setSaveDatasetName(e.target.value)}
                  placeholder="Dataset name (e.g. Sem4_BE_Final)"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: 'var(--text-xs)',
                    marginTop: '4px',
                  }}
                />
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default • Zero Persistence</span>
            </div>

            {/* Confirm Button */}
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
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Confirm & Start Analysis
            </Button>
          </GlassCard>
        ) : (
          /* INITIAL VIEW — Claude / GPT Inspired Pure Minimalism */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 'clamp(1.75rem, 3.2vw, 2.25rem)',
                fontWeight: 600,
                color: 'var(--text)',
                margin: '0 0 var(--space-2) 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Academic Result Management
            </h1>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                margin: '0 0 var(--space-8) 0',
                lineHeight: 1.6,
                maxWidth: '520px',
              }}
            >
              Upload an Excel marksheet to view student results, check passes and backlogs, and generate reports.
            </p>

            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                border: dragActive
                  ? '2px dashed var(--action-primary-bg)'
                  : '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-card)',
                background: dragActive ? 'var(--surface-active)' : 'var(--surface-card)',
                padding: 'var(--space-10) var(--space-6)',
                textAlign: 'center',
                cursor: uploading ? 'wait' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                transition: 'all var(--transition-fast)',
                boxSizing: 'border-box',
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
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                }}
              >
                <UploadCloud size={20} />
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

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                  Multi-Component (ISA/MSE/ESE)
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                  Grade Letters & Credits
                </span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                  Cohort Divisions
                </span>
              </div>

              {uploading && (
                <div
                  style={{
                    width: '180px',
                    height: '3px',
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

            {/* Sample Data 1-Click Option */}
            <div
              style={{
                marginTop: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Don't have a marksheet on hand?</span>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={uploading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'var(--text-xs)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} />
                <span>Use sample data (145 students)</span>
              </button>
            </div>

            {/* Privacy & Data Handling — Minimal Understated Note */}
            <div
              style={{
                marginTop: 'var(--space-10)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-hairline)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                maxWidth: '560px',
              }}
            >
              <strong style={{ color: 'var(--text-secondary)' }}>Privacy & Data Handling:</strong>{' '}
              Isolated temporary workspace on your computer. Instant full deletion available anytime. Zero student PII retained permanently.
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default UploadPage
