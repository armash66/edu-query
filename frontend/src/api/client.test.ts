import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ApiError,
  getHealth,
  getStudents,
  getStudentBreakdown,
  getSubjectFailureSummary,
  getDataQuality,
  previewImport,
  confirmImport,
} from './client'

describe('API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches health successfully', async () => {
    const mockHealth = {
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'read_only_file',
        connected: true,
        students_count: 145,
        courses_count: 27,
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockHealth,
    }) as unknown as typeof fetch

    const data = await getHealth()
    expect(data.status).toBe('healthy')
    expect(data.database.students_count).toBe(145)
    expect(fetch).toHaveBeenCalledWith('/health', expect.any(Object))
  })

  it('fetches students roster with query and pagination parameters', async () => {
    const mockPaginated = {
      total: 85,
      limit: 20,
      offset: 0,
      items: [{ student_id: 'S01', name: 'Student Alpha', division: 'A' }],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPaginated,
    }) as unknown as typeof fetch

    const data = await getStudents({ query: 'Alpha', division: 'A', limit: 20, offset: 0 })
    expect(data.total).toBe(85)
    expect(data.items).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/students?query=Alpha&division=A&limit=20&offset=0',
      expect.any(Object)
    )
  })

  it('fetches student breakdown for identifier', async () => {
    const mockBreakdown = {
      status: 'success',
      query: 'S01',
      student: { student_id: 'S01', name: 'Student One', division: 'A' },
      total_enrolled: 5,
      passed_count: 5,
      failed_count: 0,
      unresolved_count: 0,
      subjects: [],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBreakdown,
    }) as unknown as typeof fetch

    const data = await getStudentBreakdown('S01')
    expect(data.student.name).toBe('Student One')
    expect(fetch).toHaveBeenCalledWith('/api/v1/students/S01/breakdown', expect.any(Object))
  })

  it('handles 404 student not found with structured ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        status: 'not_found',
        error_code: 'STUDENT_NOT_FOUND',
        query: 'UNKNOWN_99',
        message: "No student record matched identifier 'UNKNOWN_99'",
      }),
    }) as unknown as typeof fetch

    await expect(getStudentBreakdown('UNKNOWN_99')).rejects.toThrow(ApiError)
    try {
      await getStudentBreakdown('UNKNOWN_99')
    } catch (err) {
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.errorCode).toBe('STUDENT_NOT_FOUND')
      expect(apiErr.query).toBe('UNKNOWN_99')
    }
  })

  it('handles 409 ambiguous student query with candidates', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        status: 'ambiguous',
        error_code: 'AMBIGUOUS_STUDENT_QUERY',
        query: 'Sharma',
        message: 'Query matches multiple candidates',
        candidates: [
          { student_id: 'STU1', name: 'Aarav Sharma' },
          { student_id: 'STU2', name: 'Bhavya Sharma' },
        ],
      }),
    }) as unknown as typeof fetch

    try {
      await getStudentBreakdown('Sharma')
      expect.unreachable('Should have thrown ApiError')
    } catch (err) {
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(409)
      expect(apiErr.errorCode).toBe('AMBIGUOUS_STUDENT_QUERY')
      expect(apiErr.ambiguousCandidates).toHaveLength(2)
    }
  })

  it('fetches subject failure summary and course failures', async () => {
    const mockSummary = {
      division_filter: null,
      total_courses_evaluated: 10,
      summary: [
        {
          course_code: 'C101',
          course_name: 'Intro to CS',
          total_enrolled: 60,
          confirmed_failures_count: 5,
          failure_rate_percent: 8.33,
        },
      ],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSummary,
    }) as unknown as typeof fetch

    const summary = await getSubjectFailureSummary()
    expect(summary.total_courses_evaluated).toBe(10)
    expect(summary.summary[0].course_code).toBe('C101')
  })

  it('fetches data quality audit findings', async () => {
    const mockQuality = {
      session_id: 'session123',
      health_status: 'Good',
      quality_score: 95.0,
      total_checks: 8,
      error_count: 0,
      warning_count: 1,
      info_count: 2,
      findings: [
        {
          check_id: 'inconsistent_totals',
          severity: 'warning',
          title: 'Total Mismatch',
          count: 1,
          problem: 'Sum difference',
          impact: 'Transcript check',
          recommended_action: 'Verify',
          details: ['Row 10'],
        },
      ],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockQuality,
    }) as unknown as typeof fetch

    const dq = await getDataQuality()
    expect(dq.health_status).toBe('Good')
    expect(dq.findings).toHaveLength(1)
  })

  it('attaches admin key to import preview and confirm', async () => {
    const mockPreview = {
      import_id: 'imp123',
      state: 'preview_ready',
      can_confirm: true,
      blocking_errors: [],
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPreview,
    }) as unknown as typeof fetch

    const file = new File([new Uint8Array([80, 75, 3, 4])], 'test.xlsx')
    await previewImport(file, 'secret-key-123')

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/imports/preview',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-EduQuery-Import-Key': 'secret-key-123',
        }),
      })
    )

    // Confirm
    const mockConfirm = {
      import_id: 'imp123',
      state: 'activated',
      active_dataset_id: 'dataset_01',
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockConfirm,
    }) as unknown as typeof fetch

    await confirmImport('imp123', 'secret-key-123')
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/imports/confirm',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-EduQuery-Import-Key': 'secret-key-123',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('wraps network failure into structured ApiError', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    await expect(getHealth()).rejects.toThrow(ApiError)
    try {
      await getHealth()
    } catch (err) {
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(0)
      expect(apiErr.errorCode).toBe('NETWORK_ERROR')
      expect(apiErr.message).toContain('Cannot connect to EduQuery backend')
    }
  })

  it('downloads student breakdown CSV as blob with authenticated session header', async () => {
    sessionStorage.setItem('eduquery_session_token', 'test-session-token-xyz')
    const mockBlob = new Blob(['student_id,course_code,total\nSTU01,C1,85'], { type: 'text/csv' })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/csv' }),
      blob: async () => mockBlob,
    }) as unknown as typeof fetch

    const { downloadStudentBreakdownCsv, getStudentBreakdownExportUrl } = await import('./client')
    const blob = await downloadStudentBreakdownCsv('STU01')
    expect(blob).toBe(mockBlob)
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/students/STU01/export',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-EduQuery-Session-Token': 'test-session-token-xyz',
          Accept: 'text/csv, application/octet-stream, */*',
        }),
      })
    )

    const url = getStudentBreakdownExportUrl('STU01')
    expect(url).not.toContain('session_token')
    expect(url).toBe('/api/v1/students/STU01/export')
    sessionStorage.clear()
  })

  it('saves blob as file without setting rel=noopener to preserve download filename and extension in Chromium/Edge', async () => {
    const { saveBlobAsFile } = await import('./client')
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:http://localhost:5173/mock-uuid-1234')
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})

    let createdAnchor: HTMLAnchorElement | null = null
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName)
      if (tagName === 'a') {
        createdAnchor = el as HTMLAnchorElement
      }
      return el
    })

    const testBlob = new Blob(['test-binary-data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveBlobAsFile(testBlob, 'EduQuery_Students.xlsx')

    expect(createdAnchor).not.toBeNull()
    expect(createdAnchor!.download).toBe('EduQuery_Students.xlsx')
    expect(createdAnchor!.getAttribute('download')).toBe('EduQuery_Students.xlsx')
    // Crucial: ensure noopener is NEVER set
    expect(createdAnchor!.rel).not.toBe('noopener')
    expect(createdAnchor!.getAttribute('rel')).toBeNull()
    expect(createObjectURLSpy).toHaveBeenCalled()
  })
})
