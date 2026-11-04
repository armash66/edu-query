import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider, useSession } from '../SessionContext'
import { HealthProvider } from '../HealthContext'
import { UploadPage } from '../../pages/UploadPage'
import * as client from '../../api/client'
import { ApiError } from '../../api/client'

// Test harness component representing App routing
function TestAppHome() {
  const { hasActiveSession } = useSession()
  if (!hasActiveSession) {
    return <UploadPage />
  }
  return <div data-testid="overview-view">Welcome to Overview</div>
}

describe('Session Restoration & Non-blocking Startup Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'in_memory',
        connected: false,
        students_count: null,
        courses_count: null,
      },
    })
  })

  it('1. Upload page renders immediately without waiting for slow session restoration', async () => {
    // Mock getSessionStatus to simulate a slow 30-second server wake up
    let resolveSlowStatus: any
    const slowPromise = new Promise<any>((resolve) => {
      resolveSlowStatus = resolve
    })
    vi.spyOn(client, 'getSessionStatus').mockImplementation(() => slowPromise)

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <TestAppHome />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    // Dropzone and upload page render immediately without being blocked by slow promise
    expect(screen.getByRole('heading', { name: /Academic Result Management/i })).toBeInTheDocument()
    expect(screen.getByText(/Drop your Excel marksheet here, or browse/i)).toBeInTheDocument()
    expect(screen.getByText(/Restoring session.../i)).toBeInTheDocument()

    // Clean up pending promise
    resolveSlowStatus({ active: false, mode: null })
  })

  it('2. Existing valid sessions transition to overview when restoration resolves', async () => {
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: true,
      state: 'active',
      session_id: 'restored-session-123',
      students_count: 145,
      courses_count: 27,
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <TestAppHome />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('overview-view')).toBeInTheDocument()
    })
  })

  it('3. Failed session restoration does not block the application and retains token', async () => {
    const clearTokenSpy = vi.spyOn(client, 'clearSessionToken')
    vi.spyOn(client, 'getSessionStatus').mockRejectedValue(
      new ApiError(0, 'REQUEST_TIMEOUT', 'Request to /api/v1/session/status timed out after 60000ms.')
    )

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <TestAppHome />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    // Page is usable and displays retry notice
    await waitFor(() => {
      expect(screen.getByText(/Previous session check timed out \(server warming up\)/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })

    // Token must NOT have been cleared for a transient timeout!
    expect(clearTokenSpy).not.toHaveBeenCalled()
  })

  it('4. Retry restores the session when backend becomes available', async () => {
    let callCount = 0
    vi.spyOn(client, 'getSessionStatus').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        throw new ApiError(0, 'NETWORK_ERROR', 'Network down')
      }
      return {
        active: true,
        state: 'active',
        session_id: 'retry-recovered-token',
        students_count: 50,
        courses_count: 5,
      }
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <TestAppHome />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    // First attempt fails, shows retry
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

    // Second attempt succeeds, switches to overview
    await waitFor(() => {
      expect(screen.getByTestId('overview-view')).toBeInTheDocument()
    })
  })

  it('5. A late session response cannot overwrite a newer upload', async () => {
    let resolveOldRestoration: any
    const oldPromise = new Promise<any>((resolve) => {
      resolveOldRestoration = resolve
    })

    vi.spyOn(client, 'getSessionStatus').mockImplementation(() => oldPromise)
    vi.spyOn(client, 'uploadSession').mockResolvedValue({
      status: 'success',
      session_id: 'newly-uploaded-id',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'new_marksheet.xlsx',
      students_count: 80,
      courses_count: 10,
      can_confirm: true,
      blocking_errors: [],
      preview: {
        sheets: ['Sheet1'],
        detected_students: 80,
        detected_subjects: 10,
        passed_count: 75,
        failed_count: 5,
        divisions: ['A'],
        format_notes: [],
      },
    })

    let sessionContextVal: any
    function ContextProbe() {
      sessionContextVal = useSession()
      return <div>Probe</div>
    }

    render(
      <SessionProvider>
        <ContextProbe />
      </SessionProvider>
    )

    // User starts upload while restoration is still in-flight
    const testFile = new File(['dummy'], 'new_marksheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await act(async () => {
      await sessionContextVal.uploadMarksheet(testFile)
    })

    expect(sessionContextVal.session?.session_id).toBe('newly-uploaded-id')

    // Now the slow restoration finally resolves with old session data
    await act(async () => {
      resolveOldRestoration({
        active: true,
        state: 'active',
        session_id: 'old-stale-session',
        students_count: 10,
        courses_count: 2,
      })
    })

    // The newer upload MUST NOT be overwritten!
    expect(sessionContextVal.session?.session_id).toBe('newly-uploaded-id')
  })

  it('6. Timeout and network errors are handled distinctly in ApiError', () => {
    const timeoutErr = new ApiError(0, 'REQUEST_TIMEOUT', 'Timed out after 60000ms')
    const netErr = new ApiError(0, 'NETWORK_ERROR', 'Connection refused')
    const httpErr = new ApiError(404, 'NOT_FOUND', 'Session expired')

    expect(timeoutErr.errorCode).toBe('REQUEST_TIMEOUT')
    expect(netErr.errorCode).toBe('NETWORK_ERROR')
    expect(httpErr.status).toBe(404)
  })
})

