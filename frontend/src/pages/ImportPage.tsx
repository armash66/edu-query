import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Database,
  FileCheck,
  XCircle,
  History,
  RotateCcw,
} from 'lucide-react'
import {
  previewImport,
  confirmImport,
  getImportStatus,
  getDatasetVersions,
  rollbackDataset,
} from '../api/client'
import {
  ApiError,
  type ImportPreviewResponse,
  type ImportConfirmResponse,
  type DatasetVersionItem,
} from '../api/types'
import { useAdminKey } from '../context/AdminKeyContext'
import { useHealth } from '../context/HealthContext'
import { AdminKeyModal } from '../components/AdminKeyModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  GlassCard,
  Button,
  StatusBadge,
  Stat,
  ErrorState,
} from '../ui'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MiB

export const ImportPage: React.FC = () => {
  const { adminKey, hasAdminKey } = useAdminKey()
  const { health, refreshHealth } = useHealth()

  const [isAdminKeyModalOpen, setIsAdminKeyModalOpen] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState<boolean>(false)
  const [clientValidationError, setClientValidationError] = useState<string | null>(null)

  // API In-Flight States
  const [previewLoading, setPreviewLoading] = useState<boolean>(false)
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<ApiError | null>(null)

  // Confirmation States
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false)
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false)
  const [confirmSuccess, setConfirmSuccess] = useState<ImportConfirmResponse | null>(null)
  const [confirmError, setConfirmError] = useState<ApiError | null>(null)

  // Dataset Versions & Rollback States
  const [versions, setVersions] = useState<DatasetVersionItem[]>([])
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false)
  const [rollbackTarget, setRollbackTarget] = useState<DatasetVersionItem | null>(null)
  const [isRollbackConfirmOpen, setIsRollbackConfirmOpen] = useState<boolean>(false)
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false)
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null)
  const [rollbackError, setRollbackError] = useState<ApiError | null>(null)

  const loadVersions = React.useCallback(async () => {
    if (!adminKey) return
    setLoadingVersions(true)
    try {
      const res = await getDatasetVersions(adminKey)
      setVersions(res.versions)
    } catch {
      // Non-blocking if no versions
    } finally {
      setLoadingVersions(false)
    }
  }, [adminKey])

  React.useEffect(() => {
    if (hasAdminKey && adminKey) {
      loadVersions()
    } else {
      setVersions([])
    }
  }, [hasAdminKey, adminKey, loadVersions])

  const handleRollbackConfirm = async () => {
    if (!rollbackTarget || !adminKey) return
    setRollbackLoading(true)
    setRollbackError(null)
    setRollbackSuccessMsg(null)
    try {
      const res = await rollbackDataset(rollbackTarget.dataset_id, adminKey)
      setRollbackSuccessMsg(res.message)
      setIsRollbackConfirmOpen(false)
      setRollbackTarget(null)
      await refreshHealth()
      await loadVersions()
    } catch (err) {
      if (err instanceof ApiError) {
        setRollbackError(err)
      } else {
        setRollbackError(new ApiError(0, 'ROLLBACK_FAILED', 'Failed to restore dataset version'))
      }
      setIsRollbackConfirmOpen(false)
    } finally {
      setRollbackLoading(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const validateAndSetFile = (file: File) => {
    setClientValidationError(null)
    setPreviewError(null)
    setPreviewData(null)
    setConfirmSuccess(null)
    setConfirmError(null)

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setClientValidationError('Only Microsoft Excel (.xlsx) workbooks are supported.')
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setClientValidationError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed 25 MB limit.`
      )
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handlePreviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) return
    if (!hasAdminKey || !adminKey) {
      setIsAdminKeyModalOpen(true)
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)

    try {
      const res = await previewImport(selectedFile, adminKey)
      setPreviewData(res)
    } catch (err) {
      if (err instanceof ApiError) {
        setPreviewError(err)
      } else {
        setPreviewError(new ApiError(0, 'PREVIEW_FAILED', 'Failed to generate workbook preview'))
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmActivation = async () => {
    if (!previewData?.import_id || !adminKey) return

    setConfirmLoading(true)
    setConfirmError(null)

    try {
      const res = await confirmImport(previewData.import_id, adminKey)
      setConfirmSuccess(res)
      setIsConfirmOpen(false)
      await refreshHealth()
      await loadVersions()
    } catch (err: unknown) {
      try {
        const status = await getImportStatus(previewData.import_id, adminKey)
        if (status.state === 'activated') {
          setConfirmSuccess({
            import_id: status.import_id,
            state: status.state,
            activated_at: status.activated_at || new Date().toISOString(),
            students_count: status.students_count || 0,
            courses_count: status.courses_count || 0,
            active_dataset_id: status.active_dataset_id || status.import_id,
            message: 'Import successfully activated after status reconciliation.',
          })
          setIsConfirmOpen(false)
          await refreshHealth()
          await loadVersions()
          return
        }
      } catch {
        // Fall through to error handler
      }

      if (err instanceof ApiError) {
        setConfirmError(err)
      } else {
        setConfirmError(new ApiError(0, 'CONFIRM_FAILED', 'Failed to confirm dataset activation'))
      }
      setIsConfirmOpen(false)
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewData(null)
    setPreviewError(null)
    setConfirmSuccess(null)
    setConfirmError(null)
    setClientValidationError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Card */}
      <GlassCard elevation={1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <UploadCloud size={22} style={{ color: 'var(--text-primary)' }} />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Marksheet Workbook Ingestion & Activation
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Upload an Excel workbook, audit candidate records and quality findings, and explicitly activate the dataset.
            </p>
          </div>

          <div>
            {hasAdminKey ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle2 size={14} style={{ color: 'var(--status-pass)' }} />}
                onClick={() => setIsAdminKeyModalOpen(true)}
              >
                Admin Key Configured
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<KeyRound size={14} />}
                onClick={() => setIsAdminKeyModalOpen(true)}
              >
                Configure Admin Key
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Admin Key Missing Warning Banner */}
      {!hasAdminKey && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--status-warn-subtle)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Administrative Authorization Required:</strong> Marksheet upload and dataset activation
              require the administrative key. Please configure your session key before previewing.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAdminKeyModalOpen(true)}
          >
            Enter Key
          </Button>
        </div>
      )}

      {/* Activation Success Screen */}
      {confirmSuccess && (
        <GlassCard elevation={2}>
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--status-pass-subtle)',
                color: 'var(--status-pass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                border: '1px solid var(--glass-border)',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Dataset Successfully Activated
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
              The new academic marksheet dataset has been activated as the primary data source. Subsequent
              faculty queries will now reflect these verified student marks.
            </p>

            <div
              style={{
                display: 'inline-flex',
                gap: '2.5rem',
                padding: '1rem 2rem',
                background: 'var(--glass-base)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--glass-border)',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>STUDENTS LOADED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{confirmSuccess.students_count}</div>
              </div>
              <div style={{ width: '1px', background: 'var(--glass-border)' }} />
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>COURSES INGESTED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{confirmSuccess.courses_count}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/students" style={{ textDecoration: 'none' }}>
                <Button variant="primary" icon={<ArrowRight size={14} />}>
                  Inspect Student Roster
                </Button>
              </Link>
              <Link to="/subjects?tab=failures" style={{ textDecoration: 'none' }}>
                <Button variant="secondary">
                  View Subject Failures
                </Button>
              </Link>
              <Button variant="secondary" onClick={handleReset}>
                Import Another Marksheet
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Confirmation Error */}
      {confirmError && (
        <ErrorState
          error={confirmError.message || 'Activation Failed'}
          onRetry={handleConfirmActivation}
        />
      )}

      {/* Upload and File Dropzone Form (Hidden after successful activation) */}
      {!confirmSuccess && (
        <GlassCard elevation={1}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--text-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Step 1: Select Marksheet Workbook
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Maximum file size: 25 MB (.xlsx only)
            </span>
          </div>

          <form onSubmit={handlePreviewSubmit}>
            {/* Dropzone */}
            <div
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              tabIndex={0}
              role="button"
              aria-label="Upload workbook file dropzone"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click()
                }
              }}
              style={{
                border: '2px dashed var(--glass-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragActive ? 'var(--glass-base)' : 'transparent',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />

              <div style={{ marginBottom: '1rem', color: 'var(--text-tertiary)' }}>
                <UploadCloud size={36} />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <FileCheck size={18} style={{ color: 'var(--status-pass)' }} />
                    <span>{selectedFile.name}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for validation
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Click or drop another file to replace
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Drop your marksheet workbook here, or <span style={{ textDecoration: 'underline' }}>browse</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Supports standard Mumbai University / autonomous engineering marksheet layouts
                  </div>
                </div>
              )}
            </div>

            {/* Client validation error */}
            {clientValidationError && (
              <div style={{ color: 'var(--status-fail)', fontSize: '0.8125rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <XCircle size={14} />
                <span>{clientValidationError}</span>
              </div>
            )}

            {/* Upload & Preview Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <div>
                {selectedFile && (
                  <Button variant="secondary" size="sm" onClick={handleReset} disabled={previewLoading}>
                    Clear Selection
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || previewLoading}
                loading={previewLoading}
                icon={!previewLoading ? <UploadCloud size={16} /> : undefined}
              >
                {previewLoading ? 'Validating & Parsing Workbook...' : 'Generate Safe Preview'}
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Preview Error Banner */}
      {previewError && (
        <ErrorState
          error={previewError.message || 'Workbook Ingestion Failed'}
          onRetry={() => {
            if (selectedFile) {
              const fakeEvent = { preventDefault: () => {} } as React.FormEvent
              handlePreviewSubmit(fakeEvent)
            }
          }}
        />
      )}

      {/* Step 2: Safe Preview Summary (No PII) */}
      {previewData && !confirmSuccess && (
        <GlassCard elevation={1}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} style={{ color: 'var(--text-primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Step 2: Candidate Dataset Preview & Audit
              </span>
            </div>
            <StatusBadge tone="warn" label="Pending Activation" />
          </div>

          <div>
            {/* Active Dataset Untouched Notice */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--status-info-subtle)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.25rem',
              }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Active Dataset Has Not Changed:</strong> This candidate dataset is stored in an
                isolated temporary session. You must review findings and confirm activation below to apply it.
              </div>
            </div>

            {/* Ingestion Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <Stat
                label="Discovered Students"
                value={previewData.students_count.toLocaleString()}
                subtext="Student records parsed"
              />
              <Stat
                label="Discovered Courses"
                value={previewData.courses_count.toLocaleString()}
                subtext="Curriculum subjects"
              />
              <Stat
                label="Component Marks"
                value={previewData.scores_count.toLocaleString()}
                subtext="Atomized mark entries"
              />
            </div>

            {/* Workbook Technical Summary */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                fontSize: '0.8125rem',
                background: 'var(--glass-base)',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--glass-border)',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Workbook File:</strong> {previewData.workbook.filename} ({(previewData.workbook.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Ingestion Strategy:</strong> <span style={{ textTransform: 'capitalize' }}>{previewData.layout.strategy}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Accepted Worksheets:</strong> {previewData.layout.sheets_accepted.join(', ') || 'None'}
              </div>
              {previewData.layout.sheets_skipped.length > 0 && (
                <div style={{ color: 'var(--text-tertiary)' }}>
                  <strong>Skipped Sheets:</strong> {previewData.layout.sheets_skipped.map((s) => Object.keys(s).join('')).join(', ')}
                </div>
              )}
            </div>

            {/* Detected Elective Groups */}
            {previewData.layout.elective_groups && previewData.layout.elective_groups.length > 0 && (
              <div
                style={{
                  background: 'var(--glass-base)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  🎯 Detected Elective Offerings ({previewData.layout.elective_groups.length} Group{previewData.layout.elective_groups.length > 1 ? 's' : ''})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {previewData.layout.elective_groups.map((grp) => (
                    <div
                      key={grp.group_id}
                      style={{
                        background: 'var(--bg-canvas)',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{grp.group_name}</strong>
                        <StatusBadge
                          tone={grp.status === 'valid' ? 'pass' : 'warn'}
                          label={grp.status === 'valid' ? 'Mutually Exclusive' : grp.status}
                          size="sm"
                        />
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        {grp.assigned_count} of {grp.total_students} students assigned ({grp.unassigned_count} unassigned, {grp.multi_assigned_count} multi-assigned)
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {grp.courses.map((c) => (
                          <span
                            key={c.code}
                            style={{
                              background: 'var(--glass-base)',
                              border: '1px solid var(--glass-border)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.6875rem',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {c.code}: {c.enrolled_count} enrolled
                          </span>
                        ))}
                      </div>
                      {grp.ambiguities && grp.ambiguities.length > 0 && (
                        <ul style={{ marginTop: '0.5rem', color: 'var(--status-fail)', fontSize: '0.75rem', paddingLeft: '1rem' }}>
                          {grp.ambiguities.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blocking Errors or Warnings */}
            {previewData.blocking_errors && previewData.blocking_errors.length > 0 ? (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--status-fail-subtle)',
                  border: '1px solid var(--glass-border)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <XCircle size={18} style={{ color: 'var(--status-fail)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ color: 'var(--status-fail)' }}>Blocking Ingestion Errors Detected:</strong>
                    <ul style={{ paddingLeft: '1.2rem', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      {previewData.blocking_errors.map((errStr, idx) => (
                        <li key={idx}>{errStr}</li>
                      ))}
                    </ul>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Dataset activation is disabled until blocking structural issues are corrected in the source workbook.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--status-pass-subtle)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.8125rem',
                }}
              >
                <CheckCircle2 size={18} style={{ color: 'var(--status-pass)', flexShrink: 0 }} />
                <div style={{ color: 'var(--text-primary)' }}>
                  <strong>Integrity Verification Passed:</strong> No blocking errors found. Candidate dataset
                  is valid for activation.
                </div>
              </div>
            )}

            {/* Step 3: Activation Callout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Session expires at: {new Date(previewData.expires_at).toLocaleTimeString()}
              </div>

              <Button
                variant="primary"
                disabled={!previewData.can_confirm || (previewData.blocking_errors && previewData.blocking_errors.length > 0)}
                onClick={() => setIsConfirmOpen(true)}
                icon={<CheckCircle2 size={16} />}
              >
                Activate This Dataset
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Dataset Provenance & Safe Rollback Section */}
      <GlassCard elevation={1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <History size={18} />
              <span>Dataset Provenance & Safe Rollback</span>
            </h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Review stored dataset versions, active dataset identification, and restore prior verified states.
            </div>
          </div>
          {hasAdminKey && (
            <Button
              variant="secondary"
              size="sm"
              onClick={loadVersions}
              disabled={loadingVersions}
              icon={<RotateCcw size={14} className={loadingVersions ? 'spin' : ''} />}
            >
              Refresh Versions
            </Button>
          )}
        </div>

        {/* Current Active Dataset Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem', padding: '1rem', background: 'var(--glass-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Active Dataset</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              {health?.database.active_dataset_id || 'default (active)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Activated At</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {health?.database.activated_at ? new Date(health.database.activated_at).toLocaleString() : 'System Baseline'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Live Record Counts</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {health?.database ? `${health.database.students_count?.toLocaleString() ?? '—'} students · ${health.database.courses_count ?? '—'} courses` : '—'}
            </div>
          </div>
        </div>

        {rollbackSuccessMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--status-pass-subtle)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              color: 'var(--text-primary)',
            }}
          >
            <CheckCircle2 size={18} style={{ color: 'var(--status-pass)' }} />
            <span>{rollbackSuccessMsg}</span>
          </div>
        )}

        {rollbackError && (
          <ErrorState error={rollbackError.message || 'Rollback failed'} />
        )}

        {!hasAdminKey ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--glass-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
            <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
              Administrative authentication is required to inspect version history and initiate dataset rollback.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAdminKeyModalOpen(true)}
              icon={<KeyRound size={14} />}
            >
              Enter Administrative Key
            </Button>
          </div>
        ) : loadingVersions && versions.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
            Loading dataset versions...
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
            No alternative dataset versions currently found on disk.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.625rem 1rem' }}>Dataset Version</th>
                  <th style={{ padding: '0.625rem 1rem' }}>Modified</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'right' }}>Size</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.625rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => (
                  <tr key={ver.dataset_id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                      {ver.dataset_id}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {ver.created_at ? new Date(ver.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {(ver.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {ver.is_active ? (
                        <StatusBadge tone="pass" label="Active" size="sm" />
                      ) : (
                        <StatusBadge tone="info" label="Available" size="sm" />
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {!ver.is_active && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RotateCcw size={12} />}
                          onClick={() => {
                            setRollbackTarget(ver)
                            setIsRollbackConfirmOpen(true)
                          }}
                        >
                          Rollback
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Confirmation Dialog */}
      {isConfirmOpen && previewData && (
        <ConfirmDialog
          title="Confirm Dataset Activation"
          message={`Activating this marksheet (${previewData.workbook.filename}) will replace the active database dataset with ${previewData.students_count.toLocaleString()} students and ${previewData.courses_count} courses for all subsequent faculty queries. Are you sure you wish to proceed?`}
          confirmLabel="Yes, Activate Dataset"
          cancelLabel="Cancel"
          danger={false}
          loading={confirmLoading}
          onConfirm={handleConfirmActivation}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}

      {/* Rollback Confirmation Dialog */}
      {isRollbackConfirmOpen && rollbackTarget && (
        <ConfirmDialog
          title="Confirm Dataset Rollback"
          message={`Are you sure you want to restore dataset "${rollbackTarget.dataset_id}"? This will atomically update the active pointer under process lock. All faculty views and reports will immediately switch to this dataset.`}
          confirmLabel="Restore This Version"
          cancelLabel="Cancel"
          danger={true}
          loading={rollbackLoading}
          onConfirm={handleRollbackConfirm}
          onCancel={() => {
            setIsRollbackConfirmOpen(false)
            setRollbackTarget(null)
          }}
        />
      )}

      {/* Admin Key Modal */}
      <AdminKeyModal
        isOpen={isAdminKeyModalOpen}
        onClose={() => setIsAdminKeyModalOpen(false)}
      />
    </div>
  )
}
