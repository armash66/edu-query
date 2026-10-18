import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DataQualityPage } from './DataQualityPage'
import * as client from '../api/client'

describe('DataQualityPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders quality metrics and findings with problem, impact, and action', async () => {
    vi.spyOn(client, 'getDataQuality').mockResolvedValue({
      session_id: 'session_dq_1',
      health_status: 'Needs Attention',
      quality_score: 92.5,
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
      expect(screen.getByText('92.5%')).toBeInTheDocument()
      expect(screen.getByText('Needs Attention')).toBeInTheDocument()
      expect(screen.getByText('Component Total Mismatch')).toBeInTheDocument()
      expect(screen.getByText('Absentee Marker Observed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Audit Scope Disclaimer:/i)).toBeInTheDocument()
    expect(screen.getByText('Audit student rows and verify physical marksheet')).toBeInTheDocument()
  })

  it('filters findings by severity tabs', async () => {
    vi.spyOn(client, 'getDataQuality').mockResolvedValue({
      session_id: 'session_dq_2',
      health_status: 'Critical',
      quality_score: 80.0,
      total_checks: 10,
      error_count: 1,
      warning_count: 1,
      info_count: 0,
      findings: [
        {
          check_id: 'CHK_CRIT_ERR',
          severity: 'error',
          title: 'Duplicate Student Seat Number',
          count: 1,
          problem: 'Multiple rows share identical seat number',
          impact: 'Records collision during ingest',
          recommended_action: 'Correct row identifier in source Excel file',
          details: [],
        },
        {
          check_id: 'CHK_WARN_1',
          severity: 'warning',
          title: 'Missing Credit Assignment',
          count: 1,
          problem: 'Course has null credits',
          impact: 'SGPI uncalculated',
          recommended_action: 'Provide course scheme credits',
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
      expect(screen.getByText('Duplicate Student Seat Number')).toBeInTheDocument()
      expect(screen.getByText('Missing Credit Assignment')).toBeInTheDocument()
    })

    // Click Errors tab
    const errorsTab = screen.getByRole('button', { name: /errors \(1\)/i })
    fireEvent.click(errorsTab)

    expect(screen.getByText('Duplicate Student Seat Number')).toBeInTheDocument()
    expect(screen.queryByText('Missing Credit Assignment')).not.toBeInTheDocument()
  })
})
