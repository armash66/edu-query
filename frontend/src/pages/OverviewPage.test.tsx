import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OverviewPage } from './OverviewPage'
import { HealthProvider } from '../context/HealthContext'
import { SessionProvider } from '../context/SessionContext'
import * as client from '../api/client'
import type {
  AnalyticsOverviewResponse,
  AnomalyFindingItem,
} from '../api/types'

const mockOverview: AnalyticsOverviewResponse = {
  status: 'ok',
  total_students: 145,
  total_courses: 27,
  passed_students: 120,
  failed_students: 20,
  unresolved_students: 5,
  conflicting_students: 0,
  quality_score: 96,
  outcome_distribution: [
    { status: 'PASSED', count: 120, percentage: 82.8 },
    { status: 'FAILED', count: 20, percentage: 13.8 },
    { status: 'UNRESOLVED', count: 5, percentage: 3.4 },
  ],
  top_failing_courses: [
    {
      course_code: 'CS-401',
      course_name: 'Database Management Systems',
      enrolled_count: 60,
      failed_count: 17,
      failure_rate_percent: 28.3,
    },
  ],
  division_summary: [
    {
      division: 'A',
      student_count: 75,
      passed_count: 65,
      failed_count: 8,
      unresolved_count: 2,
      pass_rate_percent: 86.7,
    },
  ],
  findings: [
    {
      id: 'high-failure-subject',
      severity: 'critical',
      title: 'High Failure Rate in CS-401',
      description: 'Confirmed failure rate of 28.5% across 60 enrolled students.',
      metric: '28.5%',
      drill_down_url: '/subjects/CS-401/failures',
      count: 17,
    },
  ],
}

const mockFinding: AnomalyFindingItem = {
  finding_id: 'F_01',
  category: 'score_discrepancy',
  method: 'deterministic_rule',
  severity: 'critical',
  student_id: 'ST_001',
  student_name: 'Alice Johnson',
  division: 'A',
  course_code: 'CS-401',
  score_measure: 12.0,
  score_label: 'Mismatch: 12 marks',
  contributing_features: { raw_sum: 68, printed_total: 80 },
  explanation: 'Component marks sum to 68 but printed total is 80.',
  limitations: 'Does not prove administrative fraud.',
  record_link: '/students/ST_001',
  reviewed: false,
}

describe('OverviewPage - Academic Analysis Workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders metric strip, actionable findings, and comparison charts', async () => {
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: true,
      mode: 'temporary',
      students_count: 145,
      courses_count: 27,
    })

    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'read_only_file',
        connected: true,
        students_count: 145,
        courses_count: 27,
      },
    })

    vi.spyOn(client, 'getAnalyticsOverview').mockResolvedValue(mockOverview)
    vi.spyOn(client, 'getAnomalyFindings').mockResolvedValue({
      status: 'success',
      total: 1,
      unique_affected_records: 1,
      limit: 100,
      offset: 0,
      findings: [mockFinding],
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <OverviewPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      // Metric strip checks
      expect(screen.getByText('145')).toBeInTheDocument()
      expect(screen.getByText('27')).toBeInTheDocument()
      expect(screen.getByText('82.8%')).toBeInTheDocument()
    })

    // Sections check
    expect(screen.getByText(/Subject Failure Rates/i)).toBeInTheDocument()
    expect(screen.getByText(/Division Outcomes/i)).toBeInTheDocument()
    expect(screen.getByText(/Actionable Marksheet Findings/i)).toBeInTheDocument()
    expect(screen.getByText(/Component marks sum to 68 but printed total is 80/i)).toBeInTheDocument()
  })

  it('displays empty state when no active session is loaded', async () => {
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: false,
      mode: null,
    })

    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'in_memory',
        connected: true,
        students_count: null,
        courses_count: null,
      },
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <OverviewPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/No analytics available/i)).toBeInTheDocument()
    })
  })

  it('renders error state on API rejection with retry button', async () => {
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: true,
      mode: 'temporary',
      students_count: 145,
      courses_count: 27,
    })

    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'read_only_file',
        connected: true,
        students_count: 145,
        courses_count: 27,
      },
    })

    vi.spyOn(client, 'getAnalyticsOverview').mockRejectedValue(new Error('Network error'))

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <OverviewPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Analytics Error/i)).toBeInTheDocument()
    })
  })

  it('allows opening on-demand evidence modal and toggling review verification', async () => {
    vi.spyOn(client, 'getSessionStatus').mockResolvedValue({
      active: true,
      mode: 'temporary',
      students_count: 145,
      courses_count: 27,
    })

    vi.spyOn(client, 'getHealth').mockResolvedValue({
      status: 'healthy',
      version: '3.0.0',
      database: {
        mode: 'read_only_file',
        connected: true,
        students_count: 145,
        courses_count: 27,
      },
    })

    vi.spyOn(client, 'getAnalyticsOverview').mockResolvedValue(mockOverview)
    vi.spyOn(client, 'getAnomalyFindings').mockResolvedValue({
      status: 'success',
      total: 1,
      unique_affected_records: 1,
      limit: 100,
      offset: 0,
      findings: [mockFinding],
    })

    const reviewSpy = vi.spyOn(client, 'reviewAnomalyFinding').mockResolvedValue({
      status: 'success',
      finding_id: 'F_01',
      reviewed: true,
      reviewed_by: 'Faculty Reviewer',
      reviewed_at: '2026-10-18T12:00:00Z',
      review_notes: 'Verified',
      message: 'Updated',
    })

    render(
      <SessionProvider>
        <HealthProvider>
          <MemoryRouter>
            <OverviewPage />
          </MemoryRouter>
        </HealthProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Component marks sum to 68 but printed total is 80/i)).toBeInTheDocument()
    })

    // Open evidence modal
    const evidenceBtn = screen.getByRole('button', { name: /Evidence/i })
    fireEvent.click(evidenceBtn)

    expect(screen.getByText(/Verification Evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/Source Verification Metrics/i)).toBeInTheDocument()

    // Toggle review in modal
    const markReviewBtn = screen.getByRole('button', { name: /Mark as Reviewed & Verified/i })
    fireEvent.click(markReviewBtn)

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith('F_01', expect.objectContaining({ reviewed: true }))
    })
  })
})
