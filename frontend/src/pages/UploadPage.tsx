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
        const msg = err instanceof Error ? err.message : 'Please verify the file is a valid Excel spreadsheet.'
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
    // Crucial: reset target value so choosing the same file again triggers onChange
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
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary-color)' }}>
            Academic Marksheet Analysis
          </div>
          {hasActiveSession && (
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              Active Cohort Loaded
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 0.4rem 0' }}>
          Analyze a marksheet
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          Upload an Excel marksheet (.xlsx) to review cohort outcomes, subject failure rates, and records requiring faculty verification.
        </p>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
          {errorDetails.length > 0 && (
            <ul style={{ margin: '0 0 0 1.25rem', padding: 0, fontSize: '0.82rem', lineHeight: 1.5 }}>
              {errorDetails.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setErrorMsg(null)
              setErrorDetails([])
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            style={{ alignSelf: 'flex-start', marginTop: '0.25rem', fontSize: '0.78rem' }}
          >
            Try another file
          </button>
        </div>
      )}

      {/* Preview Card (Shown after successful upload) */}
      {isPreviewReady && preview ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Marksheet Structure Detected
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {session?.filename || selectedFile?.name} &bull; Ready for confirmation
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelPreview}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
            >
              <Trash2 size={14} /> Cancel
            </button>
          </div>

          {/* Metric Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              backgroundColor: '#f8fafc',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Students Detected
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {preview.detected_students ?? session?.students_count ?? 0}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Courses / Subjects
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {preview.detected_subjects ?? session?.courses_count ?? 0}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Divisions
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                {(preview.divisions && preview.divisions.length > 0) ? preview.divisions.join(', ') : 'None / Whole Class'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Detected Sheets
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', marginTop: '0.4rem' }}>
                {(preview.sheets && preview.sheets.length > 0) ? preview.sheets.join(', ') : 'Default Sheet'}
              </div>
            </div>
          </div>

          {/* Actionable Format Notes */}
          {preview.format_notes && preview.format_notes.length > 0 && (
            <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={14} /> Marksheet layout characteristics:
              </div>
              <ul style={{ margin: '0 0 0 1.25rem', padding: 0 }}>
                {preview.format_notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Privacy Retention Mode Selection */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Select Retention Mode for this Analysis:
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Institutional persistence is strictly opt-in
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {/* Temporary Option */}
              <label
                htmlFor="retention-mode-temporary"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: privacyMode === 'temporary' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  backgroundColor: privacyMode === 'temporary' ? '#f0f7ff' : '#ffffff',
                  boxShadow: privacyMode === 'temporary' ? '0 0 0 1px var(--primary-color)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <input
                  id="retention-mode-temporary"
                  type="radio"
                  name="retentionMode"
                  value="temporary"
                  checked={privacyMode === 'temporary'}
                  onChange={() => setPrivacyMode('temporary')}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--primary-color)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Temporary Analysis
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Default • Zero Persistence
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Data is isolated to your private session. Erased completely when you click &quot;Delete session and data&quot; or upon session expiry.
                  </div>
                </div>
              </label>

              {/* Persistent Option */}
              <label
                htmlFor="retention-mode-persistent"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: privacyMode === 'persistent' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  backgroundColor: privacyMode === 'persistent' ? '#f0f7ff' : '#ffffff',
                  boxShadow: privacyMode === 'persistent' ? '0 0 0 1px var(--primary-color)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <input
                  id="retention-mode-persistent"
                  type="radio"
                  name="retentionMode"
                  value="persistent"
                  checked={privacyMode === 'persistent'}
                  onChange={() => setPrivacyMode('persistent')}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--primary-color)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Save to Institutional Storage
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Opt-In Storage
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Opt-in to retain cohort in persistent institutional database for multi-year records and historical audits.
                  </div>
                </div>
              </label>
            </div>

            {privacyMode === 'persistent' && (
              <div style={{ marginTop: '0.5rem', padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                <label htmlFor="save-dataset-name-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Institutional Dataset Label (Optional)
                </label>
                <input
                  id="save-dataset-name-input"
                  type="text"
                  value={saveDatasetName}
                  onChange={(e) => setSaveDatasetName(e.target.value)}
                  placeholder="e.g. Sem 4 Examination - May 2026"
                  className="input"
                  style={{ width: '100%', maxWidth: '380px', fontSize: '0.85rem' }}
                />
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
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
            const warningFindings = rawFindings.filter(f => f.severity === 'warning')
            const infoFindings = rawFindings.filter(f => f.severity === 'info')

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. Blocking Errors */}
                {hasBlockingErrors && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '0.84rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5', paddingBottom: '0.4rem' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}>
                        <AlertTriangle size={16} color="#dc2626" />
                        <span>Activation Blocked: Validation Errors Detected</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: '#dc2626', color: '#ffffff', textTransform: 'uppercase' }}>
                        Action Required
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                      The following critical validation errors must be resolved before cohort analysis can begin:
                    </div>

                    <ul style={{ margin: '0 0 0 1.25rem', padding: 0, lineHeight: 1.5, fontSize: '0.82rem' }}>
                      {session?.blocking_errors && session.blocking_errors.length > 0
                        ? session.blocking_errors.map((err, idx) => <li key={idx} style={{ fontWeight: 500 }}>{err}</li>)
                        : <li>Workbook failed data quality gates and cannot be activated safely.</li>
                      }
                    </ul>

                    <div style={{ marginTop: '0.25rem', padding: '0.6rem 0.75rem', backgroundColor: '#ffffff', borderRadius: '4px', border: '1px solid #fca5a5', fontSize: '0.78rem', color: '#991b1b', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 600 }}>Suggested Recovery:</span>
                      <span>Correct the flagged marks or identifiers in your original spreadsheet, then click &quot;Choose different file&quot; below to upload the corrected workbook.</span>
                    </div>
                  </div>
                )}

                {/* 2. Validation Warnings (Non-Blocking Data Quality Notice) */}
                {warningFindings.length > 0 && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      fontSize: '0.84rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fcd34d', paddingBottom: '0.45rem' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}>
                        <AlertTriangle size={16} color="#d97706" />
                        <span>Data Quality Notice ({warningFindings.length} advisory issue{warningFindings.length > 1 ? 's' : ''}) &bull; Analysis Permitted</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', textTransform: 'uppercase' }}>
                        Review Advised
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {warningFindings.map((f, idx) => (
                        <div key={idx} style={{ padding: '0.6rem 0.75rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
                          <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                            {f.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.45 }}>
                            &quot;{f.problem}&quot;
                          </div>
                          {f.details && f.details.length > 0 && (
                            <details style={{ marginTop: '0.4rem', fontSize: '0.76rem', color: '#78350f' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                                View issue details ({f.details.length} sample entries)
                              </summary>
                              <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0, lineHeight: 1.4 }}>
                                {f.details.map((d, dIdx) => (
                                  <li key={dIdx}>{d}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.76rem', color: '#78350f' }}>
                      You can proceed to explore the cohort. These warnings will remain accessible in the Data Quality tab.
                    </div>
                  </div>
                )}

                {/* 3. Informational Notes & Verified Extended-Scale */}
                {infoFindings.length > 0 && (
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1e293b' }}>
                      <Info size={15} color="#0284c7" />
                      <span>Curriculum & Assessment Characteristics:</span>
                    </div>
                    <ul style={{ margin: '0 0 0 1.25rem', padding: 0, lineHeight: 1.45 }}>
                      {infoFindings.map((f, idx) => (
                        <li key={idx}>
                          <strong>{f.title}:</strong> {f.problem}
                        </li>
                      ))}
                    </ul>
                  </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelPreview}
                    disabled={confirming}
                  >
                    Choose different file
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={confirming || isActivationBlocked}
                    aria-disabled={confirming || isActivationBlocked}
                    title={isActivationBlocked ? 'Resolve blocking validation errors before activating' : undefined}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: '200px',
                      justifyContent: 'center',
                      opacity: isActivationBlocked ? 0.5 : 1,
                      cursor: isActivationBlocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {confirming ? (
                      <>
                        <span className="spinner" style={{ width: '1rem', height: '1rem' }} /> Activating...
                      </>
                    ) : (
                      <>
                        Confirm & Start Analysis <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                {isActivationBlocked && (
                  <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 500 }}>
                    Activation is blocked due to critical validation errors above. Please correct the workbook to continue.
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      ) : (
        /* Upload Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem 2rem',
              borderRadius: 'var(--radius-md)',
              border: `2px dashed ${dragActive ? 'var(--primary-color)' : '#cbd5e1'}`,
              backgroundColor: dragActive ? '#f8fafc' : '#ffffff',
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)',
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
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: dragActive ? '#dbeafe' : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-color)',
                marginBottom: '1rem',
              }}
            >
              {uploading ? (
                <span className="spinner" style={{ width: '1.75rem', height: '1.75rem' }} />
              ) : (
                <UploadCloud size={28} />
              )}
            </div>

            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              {uploading ? 'Processing and validating marksheet...' : 'Drop your Excel marksheet here, or browse'}
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.4 }}>
              Supports Microsoft Excel OpenXML (.xlsx) up to 25 MiB.
              <br />
              Headers and multi-row formats are automatically detected.
            </div>

            {!uploading && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '1.25rem', pointerEvents: 'none' }}
              >
                Browse file
              </button>
            )}
          </div>

          {/* Privacy Statement Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
              <ShieldCheck size={18} style={{ color: '#0284c7' }} />
              <span>Privacy & Data Handling</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Your file is processed according to the selected privacy mode. You can review the data-handling details before proceeding.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.8rem',
                color: '#334155',
                marginTop: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                <Lock size={14} style={{ color: '#64748b', marginTop: '0.15rem', flexShrink: 0 }} />
                <span><strong>Isolated temporary workspace:</strong> Marksheet data is scoped to an ephemeral session with zero cross-session leakage.</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                <Trash2 size={14} style={{ color: '#64748b', marginTop: '0.15rem', flexShrink: 0 }} />
                <span><strong>Instant full deletion:</strong> Use the &quot;Delete session and data&quot; action anytime to permanently erase all records from the server.</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                <Database size={14} style={{ color: '#64748b', marginTop: '0.15rem', flexShrink: 0 }} />
                <span><strong>No external AI services:</strong> Analysis runs 100% on-premises using deterministic verified academic classification rules.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
