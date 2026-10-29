import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DataQualityPage } from './DataQualityPage'
import * as client from '../api/client'

describe('DataQualityPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders pre-declaration verification workflow and no quality score percentage', async () => {
    vi.spyOn(client, 'getDataQuality').mockResolvedValue({
      session_id: 'session_dq_1',
      health_status: 'Needs Attention',
      total_checks: 10,
      error_count: 0,
      warning_count: 1,
      info_count: 1,
      findings: [
        {
          check_id: 'CHK_TOTAL_MISMATCH',
          severity: 'warning',
          title: 'Component Total Mismatch',
          count: 2,
          problem: 'Internal component mark sum differs from printed marksheet total',
          impact: 'Potential transcription discrepancy in source sheet',
          recommended_action: 'Audit student rows and verify physical marksheet',
          details: ['Student S10', 'Student S12'],
        },
        {
          check_id: 'CHK_ABSENT_OBS',
          severity: 'info',
          title: 'Absentee Marker Observed',
          count: 5,
          problem: 'Students marked absent in one or more component evaluations',
          impact: 'Subject outcome marked as uncalculated/unresolved',
          recommended_action: 'Verify whether re-examination is scheduled',
          details: [],
        },
      ],
    })

    render(
      <MemoryRouter>
        <DataQualityPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Pre-Declaration Verification & Anomaly Review/i)).toBeInTheDocument()
      expect(screen.getAllByText('Component Total Mismatch').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Absentee Marker Observed')).toBeInTheDocument()
    })

    // Progress bar check
    expect(screen.getByText(/Review Progress: 0 of 2 reviewed/i)).toBeInTheDocument()

    // Ensure NO invented quality score percentage is shown
    expect(screen.queryByText(/92\.5%/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quality Score/i)).not.toBeInTheDocument()

    // Evidence panel should be visible for active selected finding
    expect(screen.getByText(/What was noticed/i)).toBeInTheDocument()
    expect(screen.getAllByText('Internal component mark sum differs from printed marksheet total').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Audit student rows and verify physical marksheet')).toBeInTheDocument()
  })

  it('records decisions and updates progress until Ready to Declare status flips', async () => {
    vi.spyOn(client, 'getDataQuality').mockResolvedValue({
      session_id: 'session_dq_2',
      health_status: 'Critical',
      total_checks: 10,
      error_count: 1,
      warning_count: 0,
      info_count: 0,
      findings: [
        {
          check_id: 'CHK_TOTAL_MISMATCH',
          severity: 'error',
          title: 'Printed Total vs Component Sum',
          count: 1,
          problem: 'Printed total 54 does not equal component sum 58',
          impact: 'Potential mark tabulation error',
          recommended_action: 'Confirm marks with evaluator or source register',
          details: ['Seat PCEC12T_001'],
        },
      ],
    })

    render(
      <MemoryRouter>
        <DataQualityPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Printed Total vs Component Sum').length).toBeGreaterThanOrEqual(1)
    })

    // Initial state: action required
    expect(screen.getByText(/Action Required/i)).toBeInTheDocument()
    expect(screen.getByText(/Review Progress: 0 of 1 reviewed/i)).toBeInTheDocument()

    // Click "Confirm OK"
    const confirmButton = screen.getByRole('button', { name: /confirm ok/i })
    fireEvent.click(confirmButton)

    // Status flips to "Ready to Declare" and progress shows 1 of 1
    await waitFor(() => {
      expect(screen.getByText(/Ready to Declare/i)).toBeInTheDocument()
      expect(screen.getByText(/Review Progress: 1 of 1 reviewed/i)).toBeInTheDocument()
    })
  })

  it('collapses and expands passed automated checks accordion', async () => {
    vi.spyOn(client, 'getDataQuality').mockResolvedValue({
      session_id: 'session_dq_3',
      health_status: 'Healthy',
      total_checks: 4,
      error_count: 0,
      warning_count: 0,
      info_count: 0,
      findings: [],
    })

    render(
      <MemoryRouter>
        <DataQualityPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Passed Automated Checks/i)).toBeInTheDocument()
    })

    // Initially collapsed
    expect(screen.queryByText('Duplicate Student Seat Identifiers')).not.toBeInTheDocument()

    // Click to expand accordion
    const toggleButton = screen.getByRole('button', { name: /passed automated checks/i })
    fireEvent.click(toggleButton)

    // Now expanded
    expect(screen.getByText('Duplicate Student Seat Identifiers')).toBeInTheDocument()
    expect(screen.getByText('Enrollment Schema Boundary Rules')).toBeInTheDocument()
  })
})
