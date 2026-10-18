import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UploadPage } from './UploadPage'
import { SessionProvider } from '../context/SessionContext'
import { HealthProvider } from '../context/HealthContext'
import * as client from '../api/client'

describe('UploadPage - Privacy-First Faculty Upload Experience', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: false,
      mode: null,
    })
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

  it('renders initial upload screen with title, dropzone, and privacy disclosures', async () => {
    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Analyze a marksheet/i })).toBeInTheDocument()
      expect(screen.getByText(/Drop your Excel marksheet here, or browse/i)).toBeInTheDocument()
      expect(screen.getByText(/Privacy & Data Handling/i)).toBeInTheDocument()
      expect(screen.getByText(/Isolated temporary workspace/i)).toBeInTheDocument()
      expect(screen.getByText(/Instant full deletion/i)).toBeInTheDocument()
    })
  })

  it('validates file extension and rejects non-xlsx files with friendly error message', async () => {
    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const dropzone = screen.getByText(/Drop your Excel marksheet here/i).closest('div')!
    const badFile = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' })

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [badFile],
      },
    })

    await waitFor(() => {
      expect(screen.getByText(/Invalid file format. Please upload an Excel workbook \(\.xlsx\)/i)).toBeInTheDocument()
    })
  })

  it('processes valid xlsx upload and displays detected layout preview card', async () => {
    const uploadSpy = vi.spyOn(client, 'uploadSession').mockResolvedValue({
      status: 'success',
      session_id: 'test-session-123',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'Sem4_Result.xlsx',
      students_count: 145,
      courses_count: 8,
      can_confirm: true,
      blocking_errors: [],
      preview: {
        sheets: ['Sem4_Marksheet'],
        detected_students: 145,
        detected_subjects: 8,
        divisions: ['A', 'B'],
        format_notes: ['Standard two-row header format detected'],
      },
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const dropzone = screen.getByText(/Drop your Excel marksheet here/i).closest('div')!
    const validFile = new File(['dummy xlsx bytes'], 'Sem4_Result.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [validFile],
      },
    })

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalled()
      expect(screen.getByText(/Marksheet Structure Detected/i)).toBeInTheDocument()
      expect(screen.getByText('145')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('A, B')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Confirm & Start Analysis/i })).toBeInTheDocument()
    })
  })

  it('allows selecting and re-selecting the exact same file via file input', async () => {
    let callCount = 0
    vi.spyOn(client, 'uploadSession').mockImplementation(async () => {
      callCount++
      return {
        status: 'success',
        session_id: `test-session-${callCount}`,
        mode: 'temporary',
        state: 'preview_ready',
        filename: 'Result.xlsx',
        students_count: 100,
        courses_count: 5,
        can_confirm: true,
        blocking_errors: [],
        preview: {
          sheets: ['Sheet1'],
          detected_students: 100,
          detected_subjects: 5,
          divisions: ['A'],
          format_notes: [],
        },
      }
    })

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const sameFile = new File(['dummy bytes'], 'Result.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // 1st selection
    fireEvent.change(fileInput, { target: { files: [sameFile] } })
    await waitFor(() => {
      expect(callCount).toBe(1)
      expect(screen.getByText(/Marksheet Structure Detected/i)).toBeInTheDocument()
    })

    // Cancel / choose different file
    fireEvent.click(screen.getByRole('button', { name: /Choose different file/i }))

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    // 2nd selection of the EXACT same file
    const fileInputAfterCancel = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInputAfterCancel, { target: { files: [sameFile] } })

    await waitFor(() => {
      expect(callCount).toBe(2)
      expect(screen.getByText(/Marksheet Structure Detected/i)).toBeInTheDocument()
    })
  })

  it('blocks duplicate upload attempts while an upload is in-flight', async () => {
    let resolveUpload: (val: any) => void
    const slowUploadPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })

    const uploadSpy = vi.spyOn(client, 'uploadSession').mockReturnValue(slowUploadPromise as any)

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file1 = new File(['bytes 1'], 'Workbook1.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const file2 = new File(['bytes 2'], 'Workbook2.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // Trigger first upload
    fireEvent.change(fileInput, { target: { files: [file1] } })

    // Check loading indicator shows
    expect(screen.getByText(/Processing and validating marksheet.../i)).toBeInTheDocument()
    expect(uploadSpy).toHaveBeenCalledTimes(1)

    // Attempt second upload while in-flight (should be ignored)
    fireEvent.change(fileInput, { target: { files: [file2] } })
    expect(uploadSpy).toHaveBeenCalledTimes(1)

    // Resolve first upload
    resolveUpload!({
      status: 'success',
      session_id: 'session-slow',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'Workbook1.xlsx',
      students_count: 50,
      courses_count: 4,
      can_confirm: true,
      blocking_errors: [],
      preview: {
        sheets: ['Sheet1'],
        detected_students: 50,
        detected_subjects: 4,
        divisions: ['A'],
        format_notes: [],
      },
    })

    await waitFor(() => {
      expect(screen.getByText(/Marksheet Structure Detected/i)).toBeInTheDocument()
    })
  })

  it('displays actionable error banner and details without unmounting when backend upload fails', async () => {
    vi.spyOn(client, 'uploadSession').mockRejectedValue(
      new client.ApiError(
        422,
        'UNPROCESSABLE_ENTITY',
        'Could not parse workbook structure.',
        [
          'Missing required header row for subject codes.',
          'Invalid column formatting in Division column.',
        ]
      )
    )

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const brokenFile = new File(['corrupt data'], 'Broken.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    fireEvent.change(fileInput, { target: { files: [brokenFile] } })

    await waitFor(() => {
      expect(screen.getByText('Could not parse workbook structure.')).toBeInTheDocument()
      expect(screen.getByText('Missing required header row for subject codes.')).toBeInTheDocument()
      expect(screen.getByText('Invalid column formatting in Division column.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Try another file/i })).toBeInTheDocument()
    })

    // Click "Try another file" and verify error is cleared
    fireEvent.click(screen.getByRole('button', { name: /Try another file/i }))

    await waitFor(() => {
      expect(screen.queryByText('Could not parse workbook structure.')).not.toBeInTheDocument()
    })
  })

  it('blocks files exceeding 25 MiB with an informative size error', async () => {
    const uploadSpy = vi.spyOn(client, 'uploadSession')

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const hugeFile = new File(['a'], 'Huge.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    Object.defineProperty(hugeFile, 'size', { value: 26 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [hugeFile] } })

    await waitFor(() => {
      expect(
        screen.getByText(/File size \(26.0 MiB\) exceeds the 25 MiB maximum limit\./i)
      ).toBeInTheDocument()
      expect(uploadSpy).not.toHaveBeenCalled()
    })
  })

  it('defaults retention mode to Temporary Analysis and allows opt-in to Institutional Storage', async () => {
    vi.spyOn(client, 'uploadSession').mockResolvedValue({
      status: 'success',
      session_id: 'test-session-retention',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'Result.xlsx',
      students_count: 50,
      courses_count: 5,
      can_confirm: true,
      blocking_errors: [],
      preview: {
        sheets: ['Sheet1'],
        detected_students: 50,
        detected_subjects: 5,
        divisions: ['A'],
        format_notes: [],
      },
    })

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File(['valid'], 'Result.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Marksheet Structure Detected/i)).toBeInTheDocument()
    })

    // 1. Verify Temporary Analysis is checked by default
    const tempRadio = screen.getByLabelText(/Temporary Analysis/i) as HTMLInputElement
    const permRadio = screen.getByLabelText(/Save to Institutional Storage/i) as HTMLInputElement
    expect(tempRadio.checked).toBe(true)
    expect(permRadio.checked).toBe(false)
    expect(screen.getByText(/Default • Zero Persistence/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Institutional Dataset Label/i)).not.toBeInTheDocument()

    // 2. Select Persistent mode
    fireEvent.click(permRadio)
    expect(tempRadio.checked).toBe(false)
    expect(permRadio.checked).toBe(true)
    expect(screen.getByLabelText(/Institutional Dataset Label/i)).toBeInTheDocument()

    // 3. Switch back to Temporary
    fireEvent.click(tempRadio)
    expect(tempRadio.checked).toBe(true)
    expect(permRadio.checked).toBe(false)
    expect(screen.queryByLabelText(/Institutional Dataset Label/i)).not.toBeInTheDocument()
  })

  it('displays data quality warning for out-of-range marks without blocking activation', async () => {
    vi.spyOn(client, 'uploadSession').mockResolvedValue({
      status: 'success',
      session_id: 'test-session-warning',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'Result_anonymized.xlsx',
      students_count: 145,
      courses_count: 27,
      can_confirm: true,
      blocking_errors: [],
      preview: {
        sheets: ['Sheet1'],
        detected_students: 145,
        detected_subjects: 27,
        divisions: ['A', 'B'],
        format_notes: [],
        findings: [
          {
            check_id: 'out_of_range_marks',
            severity: 'warning',
            title: 'Data quality warning: 78 score entries need review',
            count: 78,
            problem: 'Some entries fall outside the expected marks range. You can continue to explore the cohort, but affected calculations may be incomplete until these entries are reviewed.',
            details: ['Course MDMBD02 (TOT1): score 115.0'],
          },
        ],
      },
    })

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File(['valid'], 'Result_anonymized.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Data quality warning: 78 score entries need review/i)).toBeInTheDocument()
      expect(screen.getByText(/Some entries fall outside the expected marks range/i)).toBeInTheDocument()
      expect(screen.getByText(/View issue details/i)).toBeInTheDocument()
    })

    // Verify Confirm & Start Analysis button is NOT blocked
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Start Analysis/i })
    expect(confirmBtn).not.toBeDisabled()
    expect(screen.queryByText(/Activation Blocked/i)).not.toBeInTheDocument()
  })

  it('disables Confirm & Start Analysis button and displays recovery path when blocking errors exist', async () => {
    vi.spyOn(client, 'uploadSession').mockResolvedValue({
      status: 'success',
      session_id: 'test-session-blocked',
      mode: 'temporary',
      state: 'preview_ready',
      filename: 'Corrupt_records.xlsx',
      students_count: 50,
      courses_count: 5,
      can_confirm: false,
      blocking_errors: [
        'Duplicate Student Identifiers: 2 student identifier(s) appear multiple times in the marksheet.',
      ],
      preview: {
        sheets: ['Sheet1'],
        detected_students: 50,
        detected_subjects: 5,
        divisions: ['A'],
        format_notes: [],
        findings: [
          {
            check_id: 'duplicate_student_id',
            severity: 'error',
            title: 'Duplicate Student Identifiers',
            count: 2,
            problem: '2 student identifier(s) appear multiple times in the marksheet.',
          },
        ],
      },
    })

    const { container } = render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <UploadPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Drop your Excel marksheet here/i)).toBeInTheDocument()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['bad'], 'Corrupt_records.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    fireEvent.change(fileInput, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Activation Blocked: Validation Errors Detected/i)).toBeInTheDocument()
      expect(screen.getByText(/Suggested Recovery/i)).toBeInTheDocument()
    })

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Start Analysis/i })
    expect(confirmBtn).toBeDisabled()
    expect(screen.getByText(/Activation is blocked due to critical validation errors above/i)).toBeInTheDocument()
  })
})

