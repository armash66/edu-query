import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ImportPage } from './ImportPage'
import { AdminKeyProvider } from '../context/AdminKeyContext'
import { HealthProvider } from '../context/HealthContext'
import * as client from '../api/client'
import { ApiError } from '../api/types'

describe('ImportPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'read_only_file',
        connected: true,
        students_count: 100,
        courses_count: 10,
      },
    })
  })

  it('validates file extension client-side and blocks non-xlsx files', async () => {
    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    const file = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Only Microsoft Excel \(\.xlsx\) workbooks are supported/i)).toBeInTheDocument()
    })
  })

  it('validates file size client-side and blocks files exceeding 25MB', async () => {
    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    // 26 MB file
    const largeBlob = new Blob([new Uint8Array(26 * 1024 * 1024)])
    const file = new File([largeBlob], 'oversized.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/exceeds the maximum allowed 25 MB limit/i)).toBeInTheDocument()
    })
  })

  it('prompts for administrative key when attempting preview without key', async () => {
    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    const file = new File(['valid content'], 'marksheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('marksheet.xlsx')).toBeInTheDocument()
    })

    const previewBtn = screen.getByRole('button', { name: /generate safe preview/i })
    fireEvent.click(previewBtn)

    // Admin key modal opens
    await waitFor(() => {
      expect(screen.getByText('Administrative Import Key')).toBeInTheDocument()
    })
  })

  it('displays candidate preview with record counts and blocking errors disabling confirmation', async () => {
    vi.spyOn(client, 'previewImport').mockResolvedValue({
      import_id: 'imp_block_01',
      state: 'validation_failed',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 900000).toISOString(),
      workbook: {
        filename: 'broken.xlsx',
        file_size_bytes: 1048576,
        sha256: 'abc123sha',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      layout: {
        strategy: 'sheet_per_branch',
        sheets_inspected: ['Sheet1'],
        sheets_accepted: ['Sheet1'],
        sheets_skipped: [],
      },
      students_count: 50,
      courses_count: 6,
      scores_count: 300,
      enrollment_count: 300,
      reconciliation_count: 50,
      data_quality: {
        health_status: 'Critical',
        quality_score: 50.0,
        total_checks: 5,
        error_count: 1,
        warning_count: 0,
        info_count: 0,
        findings: [],
      },
      can_confirm: false,
      blocking_errors: ['Missing course header in column E'],
      active_dataset_changed: false,
    })

    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    // Set admin key in modal
    fireEvent.click(screen.getByRole('button', { name: /configure admin key/i }))
    const keyInput = screen.getByPlaceholderText(/paste administrative import key/i)
    fireEvent.change(keyInput, { target: { value: 'test-admin-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /save key in memory/i }))

    // Now select file
    const file = new File(['dummy'], 'broken.xlsx')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    const previewBtn = screen.getByRole('button', { name: /generate safe preview/i })
    fireEvent.click(previewBtn)

    await waitFor(() => {
      expect(screen.getByText('Step 2: Candidate Dataset Preview & Audit')).toBeInTheDocument()
      expect(screen.getByText('Missing course header in column E')).toBeInTheDocument()
    })

    // Confirm button must be disabled
    const activateBtn = screen.getByRole('button', { name: /activate this dataset/i })
    expect(activateBtn).toBeDisabled()
  })

  it('triggers confirmation dialog and activates dataset when can_confirm is true', async () => {
    vi.spyOn(client, 'previewImport').mockResolvedValue({
      import_id: 'imp_valid_01',
      state: 'preview_ready',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 900000).toISOString(),
      workbook: {
        filename: 'valid.xlsx',
        file_size_bytes: 1048576,
        sha256: 'validsha',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      layout: {
        strategy: 'sheet_per_branch',
        sheets_inspected: ['Sheet1'],
        sheets_accepted: ['Sheet1'],
        sheets_skipped: [],
      },
      students_count: 120,
      courses_count: 8,
      scores_count: 960,
      enrollment_count: 960,
      reconciliation_count: 120,
      data_quality: {
        health_status: 'Good',
        quality_score: 98.0,
        total_checks: 8,
        error_count: 0,
        warning_count: 1,
        info_count: 0,
        findings: [],
      },
      can_confirm: true,
      blocking_errors: [],
      active_dataset_changed: false,
    })

    const confirmSpy = vi.spyOn(client, 'confirmImport').mockResolvedValue({
      import_id: 'imp_valid_01',
      state: 'activated',
      activated_at: new Date().toISOString(),
      students_count: 120,
      courses_count: 8,
      active_dataset_id: 'dataset_valid_01',
      message: 'Dataset activated successfully',
    })

    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    // Set admin key
    fireEvent.click(screen.getByRole('button', { name: /configure admin key/i }))
    const keyInput = screen.getByPlaceholderText(/paste administrative import key/i)
    fireEvent.change(keyInput, { target: { value: 'test-admin-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /save key in memory/i }))

    // Select file and preview
    const file = new File(['dummy'], 'valid.xlsx')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /generate safe preview/i }))

    await waitFor(() => {
      expect(screen.getByText('Step 2: Candidate Dataset Preview & Audit')).toBeInTheDocument()
      expect(screen.getByText('Integrity Verification Passed:')).toBeInTheDocument()
    })

    // Click Activate to open confirmation dialog
    const activateBtn = screen.getByRole('button', { name: /activate this dataset/i })
    expect(activateBtn).not.toBeDisabled()
    fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(screen.getByText('Confirm Dataset Activation')).toBeInTheDocument()
    })

    // Confirm activation
    fireEvent.click(screen.getByRole('button', { name: /yes, activate dataset/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('imp_valid_01', 'test-admin-secret')
      expect(screen.getByText('Dataset Successfully Activated')).toBeInTheDocument()
    })
  })

  it('reconciles status if confirmation request experiences ambiguous network timeout', async () => {
    vi.spyOn(client, 'previewImport').mockResolvedValue({
      import_id: 'imp_ambig_01',
      state: 'preview_ready',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 900000).toISOString(),
      workbook: {
        filename: 'valid.xlsx',
        file_size_bytes: 1048576,
        sha256: 'validsha',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      layout: {
        strategy: 'sheet_per_branch',
        sheets_inspected: ['Sheet1'],
        sheets_accepted: ['Sheet1'],
        sheets_skipped: [],
      },
      students_count: 100,
      courses_count: 5,
      scores_count: 500,
      enrollment_count: 500,
      reconciliation_count: 100,
      data_quality: {
        health_status: 'Good',
        quality_score: 100.0,
        total_checks: 5,
        error_count: 0,
        warning_count: 0,
        info_count: 0,
        findings: [],
      },
      can_confirm: true,
      blocking_errors: [],
      active_dataset_changed: false,
    })

    // confirmImport fails with network error
    vi.spyOn(client, 'confirmImport').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network timeout during confirmation')
    )

    // getImportStatus shows it actually succeeded on backend
    vi.spyOn(client, 'getImportStatus').mockResolvedValue({
      import_id: 'imp_ambig_01',
      state: 'activated',
      created_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      can_confirm: false,
      blocking_errors: [],
      filename: 'valid.xlsx',
      file_size_bytes: 1048576,
      sha256: 'validsha',
      students_count: 100,
      courses_count: 5,
      activated_at: new Date().toISOString(),
      active_dataset_id: 'dataset_reconciled',
    })

    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    // Set key
    fireEvent.click(screen.getByRole('button', { name: /configure admin key/i }))
    const keyInput = screen.getByPlaceholderText(/paste administrative import key/i)
    fireEvent.change(keyInput, { target: { value: 'admin-key' } })
    fireEvent.click(screen.getByRole('button', { name: /save key in memory/i }))

    // Preview
    const file = new File(['dummy'], 'valid.xlsx')
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /generate safe preview/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate this dataset/i })).toBeInTheDocument()
    })

    // Click activate and confirm in dialog
    fireEvent.click(screen.getByRole('button', { name: /activate this dataset/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /yes, activate dataset/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /yes, activate dataset/i }))

    // Reconciliation should notice that status is 'activated'
    await waitFor(() => {
      expect(screen.getByText('Dataset Successfully Activated')).toBeInTheDocument()
    })
  })

  it('renders dataset versions and triggers rollback confirmation flow', async () => {
    vi.spyOn(client, 'getDatasetVersions').mockResolvedValue({
      active_dataset_id: 'dataset_v2',
      total_versions: 2,
      versions: [
        {
          dataset_id: 'dataset_v2',
          is_active: true,
          created_at: '2026-10-18T00:00:00Z',
          students_count: 100,
          courses_count: 5,
          size_bytes: 20480,
        },
        {
          dataset_id: 'dataset_v1',
          is_active: false,
          created_at: '2026-10-17T00:00:00Z',
          students_count: 80,
          courses_count: 4,
          size_bytes: 18432,
        },
      ],
    })

    const rollbackMock = vi.spyOn(client, 'rollbackDataset').mockResolvedValue({
      status: 'success',
      previous_dataset_id: 'dataset_v2',
      active_dataset_id: 'dataset_v1',
      students_count: 80,
      courses_count: 4,
      activated_at: '2026-10-18T01:00:00Z',
      message: "Successfully rolled back to dataset version 'dataset_v1'.",
    })

    render(
      <AdminKeyProvider>
        <HealthProvider>
          <MemoryRouter>
            <ImportPage />
          </MemoryRouter>
        </HealthProvider>
      </AdminKeyProvider>
    )

    // Set admin key to enable versions inspection
    fireEvent.click(screen.getByRole('button', { name: /configure admin key/i }))
    const keyInput = screen.getByPlaceholderText(/paste administrative import key/i)
    fireEvent.change(keyInput, { target: { value: 'admin-key' } })
    fireEvent.click(screen.getByRole('button', { name: /save key in memory/i }))

    // Verify versions table rendered
    await waitFor(() => {
      expect(screen.getByText('dataset_v2')).toBeInTheDocument()
      expect(screen.getByText('dataset_v1')).toBeInTheDocument()
    })

    // Click rollback on dataset_v1
    const rollbackBtn = screen.getByRole('button', { name: /rollback/i })
    fireEvent.click(rollbackBtn)

    // Verify confirmation modal opens
    await waitFor(() => {
      expect(screen.getByText(/Confirm Dataset Rollback/i)).toBeInTheDocument()
    })

    // Confirm rollback
    fireEvent.click(screen.getByRole('button', { name: /restore this version/i }))

    await waitFor(() => {
      expect(rollbackMock).toHaveBeenCalledWith('dataset_v1', 'admin-key')
      expect(screen.getByText(/Successfully rolled back to dataset version 'dataset_v1'/i)).toBeInTheDocument()
    })
  })
})
