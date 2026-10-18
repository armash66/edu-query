import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
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
import { ErrorBanner } from '../components/ErrorBanner'

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
      // Refresh global health context to update active dataset across all views
      await refreshHealth()
      await loadVersions()
    } catch (err: unknown) {
      // Reconcile status in case of timeout or network interruption
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
        // Status check failed or did not resolve, proceed with original error
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
    <div>
      {/* Header Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={20} style={{ color: 'var(--primary)' }} />
                Marksheet Workbook Ingestion & Activation
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Upload an Excel workbook, audit candidate records and quality findings, and explicitly activate the dataset.
              </div>
            </div>

            {/* Admin Key Status Pill */}
            <div>
              {hasAdminKey ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAdminKeyModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#065f46' }}
                >
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  <span>Admin Key Configured</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsAdminKeyModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <KeyRound size={14} />
                  <span>Configure Admin Key</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Key Missing Warning Banner */}
      {!hasAdminKey && (
        <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem' }}>
            <strong>Administrative Authorization Required:</strong> Marksheet upload and dataset activation
            require the administrative key. Please configure your session key before previewing.
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAdminKeyModalOpen(true)}
              style={{ marginLeft: '0.75rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            >
              Enter Key
            </button>
          </div>
        </div>
      )}

      {/* Activation Success Screen */}
      {confirmSuccess && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#a7f3d0' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
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
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#065f46', marginBottom: '0.4rem' }}>
              Dataset Successfully Activated
            </h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
              The new academic marksheet dataset has been activated as the primary data source. Subsequent
              faculty queries will now reflect these verified student marks.
            </p>

            <div style={{ display: 'inline-flex', gap: '2rem', padding: '0.85rem 1.5rem', backgroundColor: '#f0fdf4', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>STUDENTS LOADED</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#065f46' }}>{confirmSuccess.students_count}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>COURSES INGESTED</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#065f46' }}>{confirmSuccess.courses_count}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/students" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Inspect Student Roster</span>
                <ArrowRight size={14} />
              </Link>
              <Link to="/failures" className="btn btn-secondary">
                View Subject Failures
              </Link>
              <button type="button" className="btn btn-secondary" onClick={handleReset}>
                Import Another Marksheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Error */}
      {confirmError && (
        <ErrorBanner
          error={confirmError}
          title="Activation Failed"
          onRetry={handleConfirmActivation}
        />
      )}

      {/* Upload and File Dropzone Form (Hidden after successful activation) */}
      {!confirmSuccess && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">
              <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
              <span>Step 1: Select Marksheet Workbook</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Maximum file size: 25 MB (.xlsx only)
            </div>
          </div>

          <div className="card-body">
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
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />

                <div className="dropzone-icon">
                  <UploadCloud size={40} />
                </div>

                {selectedFile ? (
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <FileCheck size={18} style={{ color: '#10b981' }} />
                      <span>{selectedFile.name}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for validation
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--primary)' }}>
                      Click or drop another file to replace
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Drop your marksheet workbook here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Supports standard Mumbai University / autonomous engineering marksheet layouts
                    </div>
                  </div>
                )}
              </div>

              {/* Client validation error */}
              {clientValidationError && (
                <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <XCircle size={14} />
                  <span>{clientValidationError}</span>
                </div>
              )}

              {/* Upload & Preview Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
                <div>
                  {selectedFile && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset} disabled={previewLoading}>
                      Clear Selection
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedFile || previewLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {previewLoading ? (
                    <>
                      <span className="spinner" style={{ width: '0.85rem', height: '0.85rem' }} />
                      <span>Validating & Parsing Workbook...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Generate Safe Preview</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Error Banner */}
      {previewError && (
        <ErrorBanner
          error={previewError}
          title="Workbook Ingestion Failed"
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
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">
              <Database size={18} style={{ color: 'var(--primary)' }} />
              <span>Step 2: Candidate Dataset Preview & Audit</span>
            </div>
            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
              Pending Activation
            </span>
          </div>

          <div className="card-body">
            {/* Active Dataset Untouched Notice */}
            <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Active Dataset Has Not Changed:</strong> This candidate dataset is stored in an
                isolated temporary session. You must review findings and confirm activation below to apply it.
              </div>
            </div>

            {/* Ingestion Metrics Grid */}
            <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Discovered Students</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {previewData.students_count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student records parsed</div>
              </div>

              <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Discovered Courses</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {previewData.courses_count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curriculum subjects</div>
              </div>

              <div style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Component Marks</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {previewData.scores_count.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atomized mark entries</div>
              </div>
            </div>

            {/* Workbook Technical Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <div>
                <strong>Workbook File:</strong> {previewData.workbook.filename} ({(previewData.workbook.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)
              </div>
              <div>
                <strong>Ingestion Strategy:</strong> <span style={{ textTransform: 'capitalize' }}>{previewData.layout.strategy}</span>
              </div>
              <div>
                <strong>Accepted Worksheets:</strong> {previewData.layout.sheets_accepted.join(', ') || 'None'}
              </div>
              {previewData.layout.sheets_skipped.length > 0 && (
                <div style={{ color: 'var(--text-muted)' }}>
                  <strong>Skipped Sheets:</strong> {previewData.layout.sheets_skipped.map((s) => Object.keys(s).join('')).join(', ')}
                </div>
              )}
            </div>

            {/* Detected Elective Groups */}
            {previewData.layout.elective_groups && previewData.layout.elective_groups.length > 0 && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#166534', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                  <span>🎯 Detected Elective Offerings ({previewData.layout.elective_groups.length} Group{previewData.layout.elective_groups.length > 1 ? 's' : ''})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                  {previewData.layout.elective_groups.map((grp) => (
                    <div key={grp.group_id} style={{ backgroundColor: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid #dcfce7' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                        <strong style={{ color: '#15803d' }}>{grp.group_name}</strong>
                        <span className={`badge ${grp.status === 'valid' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                          {grp.status === 'valid' ? 'Mutually Exclusive' : grp.status}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                        {grp.assigned_count} of {grp.total_students} students assigned ({grp.unassigned_count} unassigned, {grp.multi_assigned_count} multi-assigned)
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {grp.courses.map((c) => (
                          <span
                            key={c.code}
                            style={{
                              backgroundColor: '#f1f5f9',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {c.code}: {c.enrolled_count} enrolled
                          </span>
                        ))}
                      </div>
                      {grp.ambiguities && grp.ambiguities.length > 0 && (
                        <ul style={{ marginTop: '0.4rem', color: '#b91c1c', fontSize: '0.75rem', paddingLeft: '1rem' }}>
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
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <XCircle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Blocking Ingestion Errors Detected:</strong>
                  <ul style={{ paddingLeft: '1.2rem', marginTop: '0.35rem', fontSize: '0.82rem' }}>
                    {previewData.blocking_errors.map((errStr, idx) => (
                      <li key={idx}>{errStr}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}>
                    Dataset activation is disabled until blocking structural issues are corrected in the source workbook.
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-success" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <CheckCircle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Integrity Verification Passed:</strong> No blocking errors found. Candidate dataset
                  is valid for activation.
                </div>
              </div>
            )}

            {/* Step 3: Activation Callout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Session expires at: {new Date(previewData.expires_at).toLocaleTimeString()}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={!previewData.can_confirm || (previewData.blocking_errors && previewData.blocking_errors.length > 0)}
                onClick={() => setIsConfirmOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <CheckCircle size={16} />
                <span>Activate This Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Provenance & Safe Rollback Section */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} />
              <span>Dataset Provenance & Safe Rollback</span>
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Review stored dataset versions, active dataset identification, and restore prior verified states.
            </div>
          </div>
          {hasAdminKey && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={loadVersions}
              disabled={loadingVersions}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCcw size={14} className={loadingVersions ? 'spin' : ''} />
              <span>Refresh Versions</span>
            </button>
          )}
        </div>

        {/* Current Active Dataset Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Dataset</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {health?.database.active_dataset_id || 'default (active)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Activated At</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {health?.database.activated_at ? new Date(health.database.activated_at).toLocaleString() : 'System Baseline'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Live Record Counts</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {health?.database ? `${health.database.students_count?.toLocaleString() ?? '—'} students · ${health.database.courses_count ?? '—'} courses` : '—'}
            </div>
          </div>
        </div>

        {rollbackSuccessMsg && (
          <div className="alert alert-success" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} />
            <span>{rollbackSuccessMsg}</span>
          </div>
        )}

        {rollbackError && <ErrorBanner error={rollbackError} />}

        {!hasAdminKey ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Administrative authentication is required to inspect version history and initiate dataset rollback.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIsAdminKeyModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <KeyRound size={14} />
              <span>Enter Administrative Key</span>
            </button>
          </div>
        ) : loadingVersions && versions.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading dataset versions...
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No alternative dataset versions currently found on disk.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Dataset Version</th>
                  <th style={{ textAlign: 'left' }}>Modified</th>
                  <th style={{ textAlign: 'right' }}>Size</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((ver) => (
                  <tr key={ver.dataset_id}>
                    <td style={{ fontWeight: 600, wordBreak: 'break-all' }}>
                      {ver.dataset_id}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {ver.created_at ? new Date(ver.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {(ver.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ver.is_active ? (
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Active</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Available</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!ver.is_active && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setRollbackTarget(ver)
                            setIsRollbackConfirmOpen(true)
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem' }}
                        >
                          <RotateCcw size={12} />
                          <span>Rollback</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
