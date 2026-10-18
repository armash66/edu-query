import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubjectFailuresPage } from './SubjectFailuresPage'
import * as client from '../api/client'
import { ApiError } from '../api/types'

describe('SubjectFailuresPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders curriculum failure summary table with exact API failure rates', async () => {
    vi.spyOn(client, 'getSubjectFailureSummary').mockResolvedValue({
      division_filter: null,
      total_courses_evaluated: 2,
      summary: [
        {
          course_code: 'CSC401',
          course_name: 'Analysis of Algorithms',
          credits: 4,
          kind: 'theory',
          division_filter: null,
          total_enrolled: 80,
          confirmed_failures_count: 16,
          passed_count: 60,
          unresolved_count: 4,
          failure_rate_percent: 20.0,
        },
        {
          course_code: 'CSC402',
          course_name: 'Computer Networks',
          credits: 3,
          kind: 'theory',
          division_filter: null,
          total_enrolled: 80,
          confirmed_failures_count: 0,
          passed_count: 78,
          unresolved_count: 2,
          failure_rate_percent: 0.0,
        },
      ],
    })

    render(
      <MemoryRouter>
        <SubjectFailuresPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Analysis of Algorithms')).toBeInTheDocument()
      expect(screen.getByText('Computer Networks')).toBeInTheDocument()
    })

    expect(screen.getByText('CSC401')).toBeInTheDocument()
    expect(screen.getByText('CSC402')).toBeInTheDocument()
    // Exact API failure rate
    expect(screen.getByText('20.0%')).toBeInTheDocument()
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.getAllByText('16').length).toBeGreaterThanOrEqual(1)
  })

  it('filters failure summary by division', async () => {
    const summarySpy = vi.spyOn(client, 'getSubjectFailureSummary').mockResolvedValue({
      division_filter: 'A',
      total_courses_evaluated: 1,
      summary: [
        {
          course_code: 'CSC401',
          course_name: 'Analysis of Algorithms',
          credits: 4,
          kind: 'theory',
          division_filter: 'A',
          total_enrolled: 40,
          confirmed_failures_count: 8,
          passed_count: 30,
          unresolved_count: 2,
          failure_rate_percent: 20.0,
        },
      ],
    })

    render(
      <MemoryRouter>
        <SubjectFailuresPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Analysis of Algorithms')).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/filter courses by division/i)
    fireEvent.change(select, { target: { value: 'A' } })

    await waitFor(() => {
      expect(summarySpy).toHaveBeenCalledWith('A')
    })
  })

  it('renders error banner on API failure with retry action', async () => {
    const spy = vi.spyOn(client, 'getSubjectFailureSummary').mockRejectedValue(
      new ApiError(500, 'SERVER_ERROR', 'Failed to calculate failure rates')
    )

    render(
      <MemoryRouter>
        <SubjectFailuresPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Could not load failure summary/i)).toBeInTheDocument()
    })

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
