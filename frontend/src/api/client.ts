import { ApiError } from './types'
import type {
  AnalysisRegistryResponse,
  AnalyticsOverviewResponse,
  AnomalyListResponse,
  AnomalyReviewRequest,
  AnomalyReviewResponse,
  AnomalySummaryResponse,
  CourseItem,
  DataQualityResponse,
  DatasetVersionsResponse,
  DistributionsResponse,
  DivisionComparisonResponse,
  FailurePatternsResponse,
  HealthResponse,
  ImportConfirmResponse,
  ImportPreviewResponse,
  ImportSessionStatus,
  InvestigationCapabilitiesResponse,
  InvestigationQueryRequest,
  InvestigationQueryResponse,
  PaginatedResponse,
  RollbackResponse,
  StudentBreakdownResponse,
  StudentSummaryItem,
  SubjectFailureResponse,
  SubjectFailureSummaryResponse,
  GroupedAnomalyRecord,
  SessionUploadResponse,
  SessionConfirmResponse,
  SessionStatusResponse,
  SessionDeleteResponse,
  SessionSaveResponse,
} from './types'

export { ApiError }
export type { GroupedAnomalyRecord }

// Use VITE_API_BASE_URL if configured, otherwise default to relative path (leveraging Vite dev proxy)
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

const SESSION_STORAGE_TOKEN_KEY = 'eduquery_session_token'

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(SESSION_STORAGE_TOKEN_KEY, token)
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_TOKEN_KEY)
    }
  } catch {
    // Non-blocking if storage unavailable
  }
}

export function clearSessionToken(): void {
  setSessionToken(null)
}

interface FetchOptions extends RequestInit {
  adminKey?: string | null
  sessionToken?: string | null
}

export async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Attach session token for temporary analysis session isolation
  const activeSessionToken = options.sessionToken ?? getSessionToken()
  if (activeSessionToken) {
    headers['X-EduQuery-Session-Token'] = activeSessionToken
  }

  // Only attach administrative key when explicitly provided (for legacy admin endpoints)
  if (options.adminKey) {
    headers['X-EduQuery-Import-Key'] = options.adminKey.trim()
  }

  // Ensure browser automatically computes multipart boundary for FormData uploads
  if (options.body instanceof FormData) {
    delete headers['Content-Type']
    delete headers['content-type']
  }

  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Network request failed'
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Cannot connect to EduQuery backend at ${BASE_URL || 'local server'}. Please ensure the server is running. (${message})`
    )
  }

  // Parse JSON or handle non-JSON responses
  let data: any = null
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const status = response.status
    const errorCode = data?.error_code || (data?.status === 'not_found' ? 'NOT_FOUND' : `HTTP_${status}`)
    const message = data?.message || response.statusText || 'Request failed'
    const details = Array.isArray(data?.details) ? data.details : []
    const candidates = Array.isArray(data?.candidates) ? data.candidates : undefined
    const query = data?.query

    throw new ApiError(status, errorCode, message, details, candidates, query)
  }

  return data as T
}

export async function requestBlob(path: string, options: FetchOptions = {}): Promise<Blob> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    Accept: 'text/csv, application/octet-stream, */*',
    ...(options.headers as Record<string, string>),
  }

  const activeSessionToken = options.sessionToken ?? getSessionToken()
  if (activeSessionToken) {
    headers['X-EduQuery-Session-Token'] = activeSessionToken
  }

  if (options.adminKey) {
    headers['X-EduQuery-Import-Key'] = options.adminKey.trim()
  }

  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Network request failed'
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Cannot connect to EduQuery backend at ${BASE_URL || 'local server'}. (${message})`
    )
  }

  if (!response.ok) {
    let errMessage = `Export failed with HTTP ${response.status}`
    try {
      const errData = await response.json()
      if (errData?.message) errMessage = errData.message
    } catch {
      // Ignore JSON parse failure on non-JSON error
    }
    throw new ApiError(response.status, 'EXPORT_FAILED', errMessage)
  }

  return response.blob()
}

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// =========================================================================
// Health & System Probe
// =========================================================================

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { signal })
}

// =========================================================================
// Students API
// =========================================================================

export interface StudentListParams {
  query?: string
  division?: string
  result?: string
  course_code?: string
  multi_fails?: boolean
  limit?: number
  offset?: number
}

export async function getStudents(
  params: StudentListParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<StudentSummaryItem>> {
  const searchParams = new URLSearchParams()
  if (params.query?.trim()) searchParams.set('query', params.query.trim())
  if (params.division?.trim()) searchParams.set('division', params.division.trim())
  if (params.result?.trim()) searchParams.set('result', params.result.trim())
  if (params.course_code?.trim()) searchParams.set('course_code', params.course_code.trim())
  if (params.multi_fails !== undefined && params.multi_fails !== null) {
    searchParams.set('multi_fails', String(params.multi_fails))
  }
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset))

  const qs = searchParams.toString()
  return request<PaginatedResponse<StudentSummaryItem>>(`/api/v1/students${qs ? `?${qs}` : ''}`, { signal })
}

export async function getStudentBreakdown(
  identifier: string,
  signal?: AbortSignal
): Promise<StudentBreakdownResponse> {
  const encoded = encodeURIComponent(identifier.trim())
  return request<StudentBreakdownResponse>(`/api/v1/students/${encoded}/breakdown`, { signal })
}

// =========================================================================
// Subjects API
// =========================================================================

export interface SubjectListParams {
  kind?: string
  division?: string
  limit?: number
  offset?: number
}

export async function getSubjects(
  params: SubjectListParams = {},
  signal?: AbortSignal
): Promise<PaginatedResponse<CourseItem>> {
  const searchParams = new URLSearchParams()
  if (params.kind?.trim()) searchParams.set('kind', params.kind.trim())
  if (params.division?.trim()) searchParams.set('division', params.division.trim())
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset))

  const qs = searchParams.toString()
  return request<PaginatedResponse<CourseItem>>(`/api/v1/subjects${qs ? `?${qs}` : ''}`, { signal })
}

export async function getSubjectFailureSummary(
  division?: string,
  signal?: AbortSignal
): Promise<SubjectFailureSummaryResponse> {
  const searchParams = new URLSearchParams()
  if (division?.trim()) searchParams.set('division', division.trim())
  const qs = searchParams.toString()
  return request<SubjectFailureSummaryResponse>(`/api/v1/subjects/failure-summary${qs ? `?${qs}` : ''}`, { signal })
}

export interface SubjectFailureParams {
  division?: string
  limit?: number
  offset?: number
}

export async function getSubjectFailures(
  courseCode: string,
  params: SubjectFailureParams = {},
  signal?: AbortSignal
): Promise<SubjectFailureResponse> {
  const encoded = encodeURIComponent(courseCode.trim())
  const searchParams = new URLSearchParams()
  if (params.division?.trim()) searchParams.set('division', params.division.trim())
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset))

  const qs = searchParams.toString()
  return request<SubjectFailureResponse>(`/api/v1/subjects/${encoded}/failures${qs ? `?${qs}` : ''}`, { signal })
}

// =========================================================================
// Data Quality API
// =========================================================================

export async function getDataQuality(signal?: AbortSignal): Promise<DataQualityResponse> {
  return request<DataQualityResponse>('/api/v1/data-quality', { signal })
}

// =========================================================================
// Marksheet Imports API (Protected by in-memory administrative key)
// =========================================================================

export async function previewImport(
  file: File,
  adminKey: string,
  signal?: AbortSignal
): Promise<ImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return request<ImportPreviewResponse>('/api/v1/imports/preview', {
    method: 'POST',
    body: formData,
    adminKey,
    signal,
  })
}

export async function confirmImport(
  importId: string,
  adminKey: string,
  signal?: AbortSignal
): Promise<ImportConfirmResponse> {
  return request<ImportConfirmResponse>('/api/v1/imports/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ import_id: importId.trim() }),
    adminKey,
    signal,
  })
}

export async function getImportStatus(
  importId: string,
  adminKey: string,
  signal?: AbortSignal
): Promise<ImportSessionStatus> {
  const cleanId = encodeURIComponent(importId.trim())
  return request<ImportSessionStatus>(`/api/v1/imports/${cleanId}`, {
    method: 'GET',
    adminKey,
    signal,
  })
}

export async function getDatasetVersions(
  adminKey: string,
  signal?: AbortSignal
): Promise<DatasetVersionsResponse> {
  return request<DatasetVersionsResponse>('/api/v1/imports/versions', {
    method: 'GET',
    adminKey,
    signal,
  })
}

export async function rollbackDataset(
  datasetId: string,
  adminKey: string,
  signal?: AbortSignal
): Promise<RollbackResponse> {
  return request<RollbackResponse>('/api/v1/imports/rollback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dataset_id: datasetId.trim() }),
    adminKey,
    signal,
  })
}

export async function downloadStudentBreakdownCsv(identifier: string): Promise<Blob> {
  const clean = encodeURIComponent(identifier.trim())
  return requestBlob(`/api/v1/students/${clean}/export`)
}

export async function downloadSubjectFailuresCsv(courseCode: string, division?: string | null): Promise<Blob> {
  const clean = encodeURIComponent(courseCode.trim())
  const q = division ? `?division=${encodeURIComponent(division.trim())}` : ''
  return requestBlob(`/api/v1/subjects/${clean}/failures/export${q}`)
}

export async function downloadStudentsRosterCsv(params: StudentListParams = {}): Promise<Blob> {
  const q = new URLSearchParams()
  if (params.query?.trim()) q.set('query', params.query.trim())
  if (params.division?.trim()) q.set('division', params.division.trim())
  if (params.result?.trim()) q.set('result', params.result.trim())
  if (params.course_code?.trim()) q.set('course_code', params.course_code.trim())
  if (params.multi_fails !== undefined && params.multi_fails !== null) {
    q.set('multi_fails', String(params.multi_fails))
  }
  const qs = q.toString()
  return requestBlob(`/api/v1/students/export${qs ? `?${qs}` : ''}`)
}

export async function createDownloadTicket(resourceId: string = ''): Promise<string> {
  const res = await request<{ status: string; ticket: string; expires_in_seconds: number }>(
    '/api/v1/session/download-ticket',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id: resourceId }),
    }
  )
  return res.ticket
}

export function getStudentBreakdownExportUrl(identifier: string): string {
  const clean = encodeURIComponent(identifier.trim())
  return `${BASE_URL}/api/v1/students/${clean}/export`
}

export function getSubjectFailuresExportUrl(courseCode: string, division?: string | null): string {
  const clean = encodeURIComponent(courseCode.trim())
  const params = division ? `?division=${encodeURIComponent(division.trim())}` : ''
  return `${BASE_URL}/api/v1/subjects/${clean}/failures/export${params}`
}

export function getStudentsRosterExportUrl(params: StudentListParams = {}): string {
  const q = new URLSearchParams()
  if (params.query?.trim()) q.set('query', params.query.trim())
  if (params.division?.trim()) q.set('division', params.division.trim())
  if (params.result?.trim()) q.set('result', params.result.trim())
  if (params.course_code?.trim()) q.set('course_code', params.course_code.trim())
  if (params.multi_fails !== undefined && params.multi_fails !== null) {
    q.set('multi_fails', String(params.multi_fails))
  }
  const qs = q.toString()
  return `${BASE_URL}/api/v1/students/export${qs ? `?${qs}` : ''}`
}

// =========================================================================
// Academic Analytics API
// =========================================================================

export async function getAnalyticsOverview(signal?: AbortSignal): Promise<AnalyticsOverviewResponse> {
  return request<AnalyticsOverviewResponse>('/api/v1/analytics/overview', { signal })
}

export async function getDivisionComparison(signal?: AbortSignal): Promise<DivisionComparisonResponse> {
  return request<DivisionComparisonResponse>('/api/v1/analytics/division-comparison', { signal })
}

export async function getFailurePatterns(signal?: AbortSignal): Promise<FailurePatternsResponse> {
  return request<FailurePatternsResponse>('/api/v1/analytics/failure-patterns', { signal })
}

export async function getDistributions(
  courseCode?: string,
  division?: string,
  signal?: AbortSignal
): Promise<DistributionsResponse> {
  const searchParams = new URLSearchParams()
  if (courseCode?.trim()) searchParams.set('course_code', courseCode.trim())
  if (division?.trim()) searchParams.set('division', division.trim())
  const qs = searchParams.toString()
  return request<DistributionsResponse>(`/api/v1/analytics/distributions${qs ? `?${qs}` : ''}`, { signal })
}

export async function getAnalysisRegistry(signal?: AbortSignal): Promise<AnalysisRegistryResponse> {
  return request<AnalysisRegistryResponse>('/api/v1/analytics/registry', { signal })
}

// =========================================================================
// Investigation Engine API
// =========================================================================

export async function getInvestigationCapabilities(
  signal?: AbortSignal
): Promise<InvestigationCapabilitiesResponse> {
  return request<InvestigationCapabilitiesResponse>('/api/v1/investigation/capabilities', { signal })
}

export async function runInvestigationQuery(
  req: InvestigationQueryRequest,
  signal?: AbortSignal
): Promise<InvestigationQueryResponse> {
  return request<InvestigationQueryResponse>('/api/v1/investigation/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

export async function downloadInvestigationCsv(
  req: InvestigationQueryRequest
): Promise<Blob> {
  return requestBlob('/api/v1/investigation/export-csv', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  })
}

// =========================================================================
// Explainable Anomaly Detection API
// =========================================================================

export async function getAnomalySummary(signal?: AbortSignal): Promise<AnomalySummaryResponse> {
  return request<AnomalySummaryResponse>('/api/v1/anomalies/summary', { signal })
}

export interface AnomalyFilterParams {
  category?: string
  method?: string
  severity?: string
  reviewed?: boolean
  student_id?: string
  limit?: number
  offset?: number
}

export async function getAnomalyFindings(
  params: AnomalyFilterParams = {},
  signal?: AbortSignal
): Promise<AnomalyListResponse> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.method) qs.set('method', params.method)
  if (params.severity) qs.set('severity', params.severity)
  if (params.reviewed !== undefined) qs.set('reviewed', String(params.reviewed))
  if (params.student_id?.trim()) qs.set('student_id', params.student_id.trim())
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))

  const qsStr = qs.toString()
  return request<AnomalyListResponse>(`/api/v1/anomalies/findings${qsStr ? `?${qsStr}` : ''}`, { signal })
}

export async function reviewAnomalyFinding(
  findingId: string,
  req: AnomalyReviewRequest
): Promise<AnomalyReviewResponse> {
  return request<AnomalyReviewResponse>(`/api/v1/anomalies/findings/${encodeURIComponent(findingId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

export async function reviewStudentAnomalies(
  studentId: string,
  req: AnomalyReviewRequest
): Promise<AnomalyReviewResponse[]> {
  return request<AnomalyReviewResponse[]>(`/api/v1/anomalies/students/${encodeURIComponent(studentId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
}

// =========================================================================
// Privacy-First Temporary Analysis Session Lifecycle
// =========================================================================

export async function uploadSession(file: File): Promise<SessionUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await request<SessionUploadResponse>('/api/v1/session/upload', {
    method: 'POST',
    body: formData,
  })

  if (res?.session_id) {
    setSessionToken(res.session_id)
  }

  return res
}

export async function confirmSession(sessionId?: string): Promise<SessionConfirmResponse> {
  const token = sessionId ?? getSessionToken()
  const res = await request<SessionConfirmResponse>('/api/v1/session/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: token }),
  })

  if (res?.session_id) {
    setSessionToken(res.session_id)
  }

  return res
}

export async function getSessionStatus(): Promise<SessionStatusResponse> {
  return request<SessionStatusResponse>('/api/v1/session/status')
}

export async function deleteSession(sessionId?: string): Promise<SessionDeleteResponse> {
  const token = sessionId ?? getSessionToken()
  try {
    return await request<SessionDeleteResponse>('/api/v1/session', {
      method: 'DELETE',
      headers: token ? { 'X-EduQuery-Session-Token': token } : {},
    })
  } finally {
    clearSessionToken()
  }
}

export async function saveSession(datasetName?: string): Promise<SessionSaveResponse> {
  return request<SessionSaveResponse>('/api/v1/session/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: datasetName }),
  })
}




