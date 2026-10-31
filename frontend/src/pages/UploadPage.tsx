import React, { useState, useRef } from 'react'

import { useNavigate } from 'react-router-dom'

import {

  UploadCloud,

  CheckCircle2,

  AlertTriangle,

  Info,

  ArrowRight,

} from 'lucide-react'

import { useSession } from '../context/SessionContext'

import { useHealth } from '../context/HealthContext'

import { ApiError } from '../api/client'

import { GlassCard } from '../ui/GlassCard'

import { Button } from '../ui/Button'

import { ThemeMenu } from '../components/ThemeMenu'



const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MiB



export const UploadPage: React.FC = () => {

  const navigate = useNavigate()

  const {

    session,

    preview,

    isPreviewReady,

    uploadMarksheet,

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

      {/* Top Header */}

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



      {/* Main Workspace — Swiss Minimalist Center */}

      <main

        style={{

          maxWidth: '680px',

          margin: '0 auto',

          width: '100%',

          flex: 1,

          display: 'flex',

          flexDirection: 'column',

          justifyContent: 'center',

          alignItems: 'center',

          padding: 'var(--space-8) var(--space-4)',

          boxSizing: 'border-box',

        }}

      >

        {/* Error Notice */}

        {errorMsg && (

          <GlassCard

            variant="glass-2"

            padding="md"

            style={{

              width: '100%',

              borderColor: 'var(--status-danger-border)',

              background: 'var(--status-danger-bg)',

              color: 'var(--status-danger-text)',

              display: 'flex',

              flexDirection: 'column',

              gap: 'var(--space-2)',

              marginBottom: 'var(--space-6)',

              boxSizing: 'border-box',

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



        {/* PREVIEW READY (Real data detected from uploaded Excel file) */}

        {isPreviewReady && preview ? (

          <GlassCard

            variant="glass-2"

            padding="xl"

            style={{

              width: '100%',

              maxWidth: '620px',

              margin: '0 auto',

              padding: '32px',

              display: 'flex',

              flexDirection: 'column',

              gap: '28px',

              boxSizing: 'border-box',

            }}

          >

            {/* Header */}

            <div

              style={{

                display: 'flex',

                alignItems: 'center',

                justifyContent: 'space-between',

                paddingBottom: '20px',

                borderBottom: '1px solid var(--border)',

                flexWrap: 'wrap',

                gap: '16px',

              }}

            >

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

                <div

                  style={{

                    width: '34px',

                    height: '34px',

                    borderRadius: '50%',

                    background: 'rgba(255, 255, 255, 0.05)',

                    border: '1px solid var(--border)',

                    display: 'flex',

                    alignItems: 'center',

                    justifyContent: 'center',

                    flexShrink: 0,

                  }}

                >

                  <CheckCircle2 size={16} style={{ color: 'var(--text)' }} />

                </div>

                <div>

                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>

                    Marksheet Structure Detected

                  </h2>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>

                    {session?.filename || 'Uploaded Marksheet'}

                  </div>

                </div>

              </div>



              <Button size="sm" variant="secondary" onClick={handleCancelPreview} style={{ fontSize: '12px' }}>

                Choose different file

              </Button>

            </div>



            {/* Metrics Band — Hairline Divided Swiss Layout with Generous Spacing */}

            <div

              style={{

                display: 'grid',

                gridTemplateColumns: 'repeat(3, 1fr)',

                border: '1px solid var(--border)',

                borderRadius: 'var(--radius-sm)',

                overflow: 'hidden',

                background: 'rgba(255, 255, 255, 0.02)',

              }}

            >

              <div

                style={{

                  padding: '22px 16px',

                  borderRight: '1px solid var(--border)',

                  textAlign: 'center',

                }}

              >

                <div

                  style={{

                    fontSize: '11px',

                    color: 'var(--text-muted)',

                    textTransform: 'uppercase',

                    letterSpacing: '0.06em',

                    fontWeight: 500,

                  }}

                >

                  Students

                </div>

                <div

                  className="tabular-nums font-mono"

                  style={{

                    fontSize: '2rem',

                    fontWeight: 600,

                    color: 'var(--text)',

                    marginTop: '6px',

                    lineHeight: 1.1,

                  }}

                >

                  {preview.detected_students ?? preview.students_count ?? session?.students_count ?? 0}

                </div>

              </div>



              <div

                style={{

                  padding: '22px 16px',

                  borderRight: '1px solid var(--border)',

                  textAlign: 'center',

                }}

              >

                <div

                  style={{

                    fontSize: '11px',

                    color: 'var(--text-muted)',

                    textTransform: 'uppercase',

                    letterSpacing: '0.06em',

                    fontWeight: 500,

                  }}

                >

                  Courses

                </div>

                <div

                  className="tabular-nums font-mono"

                  style={{

                    fontSize: '2rem',

                    fontWeight: 600,

                    color: 'var(--text)',

                    marginTop: '6px',

                    lineHeight: 1.1,

                  }}

                >

                  {preview.detected_subjects ?? preview.courses_count ?? session?.courses_count ?? 0}

                </div>

              </div>



              <div

                style={{

                  padding: '22px 16px',

                  textAlign: 'center',

                  display: 'flex',

                  flexDirection: 'column',

                  justifyContent: 'center',

                }}

              >

                <div

                  style={{

                    fontSize: '11px',

                    color: 'var(--text-muted)',

                    textTransform: 'uppercase',

                    letterSpacing: '0.06em',

                    fontWeight: 500,

                  }}

                >

                  Divisions

                </div>

                <div

                  style={{

                    fontSize: 'var(--text-sm)',

                    fontWeight: 500,

                    color: 'var(--text)',

                    marginTop: '10px',

                    textOverflow: 'ellipsis',

                    overflow: 'hidden',

                    whiteSpace: 'nowrap',

                    lineHeight: 1.2,

                  }}

                  title={preview.divisions && preview.divisions.length > 0 ? preview.divisions.join(', ') : 'All'}

                >

                  {preview.divisions && preview.divisions.length > 0 ? preview.divisions.join(', ') : 'All'}

                </div>

              </div>

            </div>



            {/* Non-blocking warnings — Pure Monochrome Minimalism (No Yellow) */}

            {!isActivationBlocked && warningFindings.length > 0 && (

              <div

                style={{

                  fontSize: 'var(--text-xs)',

                  padding: '16px 18px',

                  borderRadius: 'var(--radius-sm)',

                  background: 'rgba(255, 255, 255, 0.02)',

                  border: '1px solid var(--border)',

                  color: 'var(--text-secondary)',

                  lineHeight: 1.6,

                }}

              >

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>

                  <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />

                  <div style={{ flex: 1 }}>

                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>

                      {warningFindings[0]?.title || 'Data quality warning: Score entries need review'}

                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>

                      {warningFindings[0]?.problem || 'Some entries fall outside the expected marks range.'}

                    </div>

                    {warningFindings[0]?.details && warningFindings[0].details.length > 0 && (

                      <details style={{ marginTop: '8px' }}>

                        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500, userSelect: 'none' }}>

                          View issue details

                        </summary>

                        <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'var(--text-muted)' }}>

                          {warningFindings[0].details.map((d, dIdx) => (

                            <li key={dIdx} style={{ marginTop: '2px' }}>{d}</li>

                          ))}

                        </ul>

                      </details>

                    )}

                  </div>

                </div>

              </div>

            )}



            {/* Critical Blocking Errors */}

            {isActivationBlocked && (

              <div

                style={{

                  fontSize: 'var(--text-xs)',

                  padding: '16px 18px',

                  borderRadius: 'var(--radius-sm)',

                  background: 'var(--status-danger-bg)',

                  border: '1px solid var(--status-danger-border)',

                  color: 'var(--status-danger-text)',

                  lineHeight: 1.6,

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

                <div style={{ marginTop: '8px', fontWeight: 600 }}>Suggested Recovery:</div>

                <div>Inspect the source Excel sheet and remove duplicate rows or ensure distinct seat numbers.</div>

              </div>

            )}



            {/* Retention Mode — Generous Spacing */}

            <div

              style={{

                display: 'flex',

                flexDirection: 'column',

                gap: '8px',

              }}

            >

              <div

                style={{

                  display: 'grid',

                  gridTemplateColumns: '1fr 1fr',

                  gap: '12px',

                }}

              >

                <label

                  style={{

                    display: 'flex',

                    alignItems: 'center',

                    gap: '10px',

                    padding: '12px 16px',

                    borderRadius: 'var(--radius-sm)',

                    border: `1px solid ${privacyMode === 'temporary' ? 'var(--text)' : 'var(--border)'}`,

                    background: privacyMode === 'temporary' ? 'var(--surface-hover)' : 'transparent',

                    cursor: 'pointer',

                    transition: 'border-color 0.15s ease',

                  }}

                >

                  <input

                    type="radio"

                    name="retention_mode"

                    value="temporary"

                    checked={privacyMode === 'temporary'}

                    onChange={() => setPrivacyMode('temporary')}

                    style={{ accentColor: 'var(--text)', cursor: 'pointer' }}

                  />

                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text)' }}>

                    Temporary Analysis

                  </span>

                </label>



                <label

                  style={{

                    display: 'flex',

                    alignItems: 'center',

                    gap: '10px',

                    padding: '12px 16px',

                    borderRadius: 'var(--radius-sm)',

                    border: `1px solid ${privacyMode === 'persistent' ? 'var(--text)' : 'var(--border)'}`,

                    background: privacyMode === 'persistent' ? 'var(--surface-hover)' : 'transparent',

                    cursor: 'pointer',

                    transition: 'border-color 0.15s ease',

                  }}

                >

                  <input

                    type="radio"

                    name="retention_mode"

                    value="persistent"

                    checked={privacyMode === 'persistent'}

                    onChange={() => setPrivacyMode('persistent')}

                    style={{ accentColor: 'var(--text)', cursor: 'pointer' }}

                  />

                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>

                    Save to Institutional Storage

                  </span>

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

                    padding: '10px 14px',

                    borderRadius: 'var(--radius-sm)',

                    border: '1px solid var(--border)',

                    background: 'var(--surface-hover)',

                    color: 'var(--text)',

                    fontSize: 'var(--text-xs)',

                    marginTop: '4px',

                    outline: 'none',

                  }}

                />

              )}



              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>

                Default • Zero Persistence

              </span>

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

              icon={<ArrowRight size={15} />}

              aria-label="Confirm & Start Analysis"

              style={{

                width: '100%',

                height: '46px',

                fontSize: '13px',

                fontWeight: 600,

                justifyContent: 'center',

                borderRadius: 'var(--radius-sm)',

                marginTop: '4px',

              }}

            >

              Confirm & Start Analysis

            </Button>

          </GlassCard>

        ) : (

          /* INITIAL VIEW — Pure Swiss Minimalism: Focused Upload Only (No Clutter) */

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

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

                maxWidth: '500px',

              }}

            >

              Upload an Excel marksheet to view student results, check passes and backlogs, and generate reports.

            </p>



            {/* Clean, Focused Dropzone */}

            <div

              onDragOver={handleDragOver}

              onDragLeave={handleDragLeave}

              onDrop={handleDrop}

              onClick={() => fileInputRef.current?.click()}

              style={{

                width: '100%',

                border: dragActive

                  ? '1.5px dashed var(--action-primary-bg)'

                  : '1px dashed var(--border-strong)',

                borderRadius: 'var(--radius-card)',

                background: dragActive ? 'var(--surface-active)' : 'var(--surface-card)',

                padding: 'var(--space-12) var(--space-6)',

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



              {/* Refined Icon Badge */}

              <div

                style={{

                  width: '52px',

                  height: '52px',

                  borderRadius: '50%',

                  background: 'var(--surface-hover)',

                  border: '1px solid var(--border)',

                  display: 'flex',

                  alignItems: 'center',

                  justifyContent: 'center',

                  color: 'var(--text)',

                  marginBottom: 'var(--space-1)',

                  transition: 'transform var(--transition-fast)',

                }}

              >

                <UploadCloud size={24} strokeWidth={1.75} />

              </div>



              <div>

                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>

                  {uploading

                    ? 'Processing and validating marksheet...'

                    : 'Drop your Excel marksheet here, or browse'}

                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>

                  Supports standard university marksheet workbooks (.xlsx) up to 25 MiB

                </div>

              </div>



              {/* Refined Metadata Dot-Separators (Replaces clunky rectangular badges) */}

              <div

                style={{

                  display: 'flex',

                  alignItems: 'center',

                  justifyContent: 'center',

                  flexWrap: 'wrap',

                  gap: '12px',

                  marginTop: 'var(--space-2)',

                  fontSize: '11px',

                  color: 'var(--text-muted)',

                }}

              >

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>

                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />

                  Multi-Component (ISA/MSE/ESE)

                </span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>

                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />

                  Grade Letters & Credits

                </span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>

                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }} />

                  Class Divisions

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



            {/* Subtle, Understated Privacy Note (Zero Clutter) */}

            <div

              style={{

                marginTop: 'var(--space-8)',

                paddingTop: 'var(--space-4)',

                borderTop: '1px solid var(--border-hairline)',

                fontSize: '11px',

                color: 'var(--text-muted)',

                lineHeight: 1.6,

                maxWidth: '540px',

              }}

            >

              <strong style={{ color: 'var(--text-secondary)' }}>Privacy & Data Handling:</strong>{' '}

              Isolated temporary workspace on your machine. Instant full deletion available anytime. Zero student PII retained permanently.

            </div>

          </div>

        )}

      </main>

    </div>

  )

}



export default UploadPage

