import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OverviewPage } from './OverviewPage'
import { HealthProvider } from '../context/HealthContext'
import { SessionProvider } from '../context/SessionContext'
import * as client from '../api/client'
import type { OverviewSummaryResponse } from '../api/types'

const mockOverviewSummary: OverviewSummaryResponse = {
  dataset: {
    id: 'synthetic_dataset_145',
    name: 'Synthetic Marks Cohort',
    status_label: 'Saved dataset',
    is_temporary: false,
    expires_in_minutes: null,
  },
  kpis: {
    total_students: 145,
    total_courses: 27,
    passed_students: 132,
    failed_students: 13,
    absent_students: 0,
    pass_rate_percent: 91.0,
    divisions_count: 2,
    needs_attention_count: 8,
    sgpi_average: 8.8,
    sgpi_median: 8.9,
    students_with_sgpi: 132,
    students_without_sgpi: 13,
  },
  needs_attention: [
    {
      student_id: '23108A0143',
      student_name: 'Patel Atharv Deepak Usha',
      severity: 'warning',
      reason: 'Unusual Combination of Marks and Failures',
      finding_id: 'ML-ISOFOREST-0143',
      record_link: '/students/23108A0143',
      evidence: 'Student failed 3 components but had exceptional scores in lab work.',
      recommended_action: 'Perform moderator reconciliation.',
    },
    {
      student_id: '23108A0147',
      student_name: 'Sethi Rudra Naresh Anita',
      severity: 'warning',
      reason: 'Large Difference Between Subject Marks',
      finding_id: 'ML-ISOFOREST-0147',
      record_link: '/students/23108A0147',
      evidence: 'Variance exceeds 2 standard deviations across theory exams.',
      recommended_action: 'Verify theory marks tabulation.',
    },
  ],
  results: {
    passed: { count: 132, percentage: 91.0 },
    failed: { count: 13, percentage: 9.0 },
    absent: { count: 0, percentage: 0.0 },
    divisions: [
      {
        division: 'Division A',
        division_code: 'A',
        passed: 75,
        enrolled: 85,
        pass_rate_percent: 88.2,
      },
      {
        division: 'Division B',
        division_code: 'B',
        passed: 57,
        enrolled: 60,
        pass_rate_percent: 95.0,
      },
    ],
  },
  sgpi_distribution: {
    average: 8.8,
    median: 8.9,
    students_with_sgpi: 132,
    students_without_sgpi: 13,
    bins: [
      { bin_label: '0-1', min_val: 0, max_val: 1, count: 0, percentage: 0.0 },
      { bin_label: '1-2', min_val: 1, max_val: 2, count: 0, percentage: 0.0 },
      { bin_label: '2-3', min_val: 2, max_val: 3, count: 0, percentage: 0.0 },
      { bin_label: '3-4', min_val: 3, max_val: 4, count: 0, percentage: 0.0 },
      { bin_label: '4-5', min_val: 4, max_val: 5, count: 0, percentage: 0.0 },
      { bin_label: '5-6', min_val: 5, max_val: 6, count: 0, percentage: 0.0 },
      { bin_label: '6-7', min_val: 6, max_val: 7, count: 7, percentage: 5.3 },
      { bin_label: '7-8', min_val: 7, max_val: 8, count: 20, percentage: 15.2 },
      { bin_label: '8-9', min_val: 8, max_val: 9, count: 43, percentage: 32.6 },
      { bin_label: '9-10', min_val: 9, max_val: 10, count: 62, percentage: 47.0 },
    ],
  },
  hardest_subjects: [
    {
      course_code: 'PCEC12T',
      course_title: 'Theory of Computer Science',
      failed_count: 12,
      enrolled_count: 145,
      failure_rate_percent: 8.3,
      tier: 'amber',
    },
    {
      course_code: 'MDM01',
      course_title: 'Data Management and Visualization',
      failed_count: 6,
      enrolled_count: 145,
      failure_rate_percent: 4.1,
      tier: 'neutral',
    },
    {
      course_code: 'PCEC13T',
      course_title: 'Database Management Systems',
      failed_count: 6,
      enrolled_count: 145,
      failure_rate_percent: 4.1,
      tier: 'neutral',
    },
    {
      course_code: 'PCEC14P',
      course_title: 'Computer Networks Lab',
      failed_count: 6,
      enrolled_count: 145,
      failure_rate_percent: 4.1,
      tier: 'neutral',
    },
    {
      course_code: 'PCEC14T',
      course_title: 'Computer Networks',
      failed_count: 6,
      enrolled_count: 145,
      failure_rate_percent: 4.1,
      tier: 'neutral',
    },
  ],
  highlights: [
    {
      id: 'highest_failure_course',
      text: 'Theory of Computer Science has the highest failure rate: 8.3% (12 students).',
      url: '/subjects?search=PCEC12T',
    },
    {
      id: 'division_pass_rate_gap',
      text: "Division B's pass rate is 6.8 points higher than Division A's.",
      url: '/explore?division=B',
    },
    {
      id: 'multi_subject_failures',
      text: '9 students failed two or more subjects.',
      url: '/explore?multi_fails=true',
    },
  ],
}

describe('OverviewPage - Monochrome Glass Academic Overview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all synthetic ground truth metrics correctly in the DOM (D2)', async () => {
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

    vi.spyOn(client, 'getOverviewSummary').mockResolvedValue(mockOverviewSummary)

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
      // 1. KPI row checks
      expect(screen.getByTestId('kpi-total-students')).toHaveTextContent('145')
      expect(screen.getByTestId('kpi-pass-rate')).toHaveTextContent('91.0%')
      expect(screen.getByTestId('kpi-needs-attention')).toHaveTextContent('8')
      expect(screen.getByTestId('kpi-average-sgpi')).toHaveTextContent('8.8')
    })

    // Subtitle check
    expect(screen.getByText(/145 students • 27 courses/i)).toBeInTheDocument()

    // 2. Division Breakdown checks
    expect(screen.getByText('Division A')).toBeInTheDocument()
    expect(screen.getByText(/75 of 85 passed • 88.2%/i)).toBeInTheDocument()
    expect(screen.getByText('Division B')).toBeInTheDocument()
    expect(screen.getByText(/57 of 60 passed • 95.0%/i)).toBeInTheDocument()

    // 3. Needs attention student checks
    expect(screen.getByText(/Patel Atharv Deepak Usha/i)).toBeInTheDocument()
    expect(screen.getByText(/Unusual Combination of Marks and Failures/i)).toBeInTheDocument()
    expect(screen.getByText(/View all 8 findings/i)).toBeInTheDocument()

    // 4. Hardest subjects checks
    expect(screen.getByText('PCEC12T')).toBeInTheDocument()
    expect(screen.getByText('Theory of Computer Science')).toBeInTheDocument()
    expect(screen.getByText(/12 of 145 \(8.3%\)/i)).toBeInTheDocument()

    // 5. SGPI Distribution & Note checks
    expect(screen.getByText(/13 students without SGPI \(failed\)/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Median 8.9/i).length).toBeGreaterThanOrEqual(1)

    // 6. Highlights strip sentences check
    expect(
      screen.getByText(/Theory of Computer Science has the highest failure rate: 8.3% \(12 students\)\./i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Division B's pass rate is 6.8 points higher than Division A's\./i)
    ).toBeInTheDocument()
    expect(screen.getByText(/9 students failed two or more subjects\./i)).toBeInTheDocument()
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

    vi.spyOn(client, 'getOverviewSummary').mockResolvedValue(mockOverviewSummary)

    const reviewSpy = vi.spyOn(client, 'reviewAnomalyFinding').mockResolvedValue({
      status: 'success',
      finding_id: 'ML-ISOFOREST-0143',
      reviewed: true,
      reviewed_by: 'Faculty Moderator',
      reviewed_at: '2026-10-28T12:00:00Z',
      review_notes: 'Verified by faculty moderator',
      message: 'Review updated',
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
      expect(screen.getByText(/Patel Atharv Deepak Usha/i)).toBeInTheDocument()
    })

    // Open review modal
    const reviewBtn = screen.getByRole('button', { name: /Review finding for Patel Atharv Deepak Usha/i })
    fireEvent.click(reviewBtn)

    expect(screen.getByText(/Review Finding Evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/Student failed 3 components but had exceptional scores in lab work/i)).toBeInTheDocument()

    // Mark as reviewed
    const markReviewBtn = screen.getByRole('button', { name: /Mark as Reviewed & Verified/i })
    fireEvent.click(markReviewBtn)

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith('ML-ISOFOREST-0143', expect.objectContaining({ reviewed: true }))
    })
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
      expect(screen.getByText(/No marksheet loaded/i)).toBeInTheDocument()
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

    vi.spyOn(client, 'getOverviewSummary').mockRejectedValue(new Error('Network error'))

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
      expect(screen.getByText(/Overview Error/i)).toBeInTheDocument()
    })
  })
})
