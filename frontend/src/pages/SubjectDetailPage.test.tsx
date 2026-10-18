import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SubjectDetailPage } from './SubjectDetailPage'
import * as client from '../api/client'

describe('SubjectDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders confirmed failing students roster with component scores', async () => {
    vi.spyOn(client, 'getSubjectFailures').mockResolvedValue({
      status: 'success',
      course_code: 'CSC501',
      course_name: 'Software Engineering',
      division_filter: null,
      credits: 3,
      kind: 'theory',
      total_enrolled: 65,
      confirmed_failures_count: 1,
      passed_count: 62,
      unresolved_count: 2,
      failure_rate_percent: 1.54,
      limit: 25,
      offset: 0,
      failing_students: [
        {
          student_id: 'STU050',
          name: 'Edward Norton',
          roll_no: '50',
          seat_no: 'SEAT_50',
          division: 'A',
          course_code: 'CSC501',
          course_name: 'Software Engineering',
          total_marks: 28,
          letter_grade: 'F',
          flags: [],
          is_absent: false,
          components: {
            TH: { component: 'TH', marks: 20, flag: null, state: 'marked', raw_text: null },
            IA: { component: 'IA', marks: 8, flag: null, state: 'marked', raw_text: null },
          },
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/subjects/CSC501/failures']}>
        <Routes>
          <Route path="/subjects/:courseCode/failures" element={<SubjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Software Engineering')).toBeInTheDocument()
      expect(screen.getByText('Edward Norton')).toBeInTheDocument()
    })

    expect(screen.getByText('CSC501')).toBeInTheDocument()
    expect(screen.getByText(/Confirmed Failures:/i)).toBeInTheDocument()
    expect(screen.getByText(/Failure Rate:/i)).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('renders clean Zero Confirmed Failures card when failure count is zero', async () => {
    vi.spyOn(client, 'getSubjectFailures').mockResolvedValue({
      status: 'success',
      course_code: 'CSC502',
      course_name: 'Data Warehousing & Mining',
      division_filter: null,
      credits: 4,
      kind: 'theory',
      total_enrolled: 72,
      confirmed_failures_count: 0,
      passed_count: 72,
      unresolved_count: 0,
      failure_rate_percent: 0.0,
      limit: 25,
      offset: 0,
      failing_students: [],
    })

    render(
      <MemoryRouter initialEntries={['/subjects/CSC502/failures']}>
        <Routes>
          <Route path="/subjects/:courseCode/failures" element={<SubjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Zero Confirmed Failures')).toBeInTheDocument()
      expect(screen.getByText(/successfully passed or are unresolved/i)).toBeInTheDocument()
    })
  })
})
