import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StudentDetailPage } from './StudentDetailPage'
import * as client from '../api/client'
import { ApiError } from '../api/types'

describe('StudentDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders student detail with component breakdown and total reconciliation', async () => {
    vi.spyOn(client, 'getStudentBreakdown').mockResolvedValue({
      status: 'success',
      query: 'STU001',
      student: {
        student_id: 'STU001',
        name: 'Carlos Mendez',
        roll_no: '201',
        seat_no: 'SEAT_C1',
        email: 'carlos@uni.edu',
        division: 'C',
        level: 'UG',
        total_marks: 385,
        total_credits: 24,
        sgpi: 7.25,
        cgpa: 7.4,
        overall_result: 'PASS',
      },
      total_enrolled: 2,
      passed_count: 1,
      failed_count: 1,
      unresolved_count: 0,
      subjects: [
        {
          course_code: 'CSC301',
          course_name: 'Database Management Systems',
          kind: 'theory',
          credits: 4,
          components: {
            IA: { component: 'IA', marks: 18, flag: null, state: 'marked', raw_text: null },
            TH: { component: 'TH', marks: 52, flag: null, state: 'marked', raw_text: null },
          },
          total_marks: 70,
          computed_marks_sum: 70,
          total_match: true,
          letter_grade: 'B',
          recorded_result: 'passed',
          flags: [],
          is_absent: false,
          has_missing_marks: false,
          has_uncalculated_total: false,
        },
        {
          course_code: 'CSC302',
          course_name: 'Applied Mathematics III',
          kind: 'theory',
          credits: 4,
          components: {
            IA: { component: 'IA', marks: 8, flag: null, state: 'marked', raw_text: null },
            TH: { component: 'TH', marks: 22, flag: null, state: 'marked', raw_text: null },
          },
          total_marks: 30,
          computed_marks_sum: 30,
          total_match: true,
          letter_grade: 'F',
          recorded_result: 'failed',
          flags: [],
          is_absent: false,
          has_missing_marks: false,
          has_uncalculated_total: false,
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/students/STU001']}>
        <Routes>
          <Route path="/students/:identifier" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendez')).toBeInTheDocument()
      expect(screen.getByText('Database Management Systems')).toBeInTheDocument()
      expect(screen.getByText('Applied Mathematics III')).toBeInTheDocument()
    })

    expect(screen.getByText('Roll No:')).toBeInTheDocument()
    expect(screen.getByText('201')).toBeInTheDocument()
    expect(screen.getByText('Division:')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText(/385/)).toBeInTheDocument()
    expect(screen.getByText('CSC301')).toBeInTheDocument()
    expect(screen.getByText('CSC302')).toBeInTheDocument()
    expect(screen.getAllByText(/Match/i).length).toBeGreaterThan(0)
  })

  it('renders unresolved components properly without collapsing to pass/fail', async () => {
    vi.spyOn(client, 'getStudentBreakdown').mockResolvedValue({
      status: 'success',
      query: 'STU003',
      student: {
        student_id: 'STU003',
        name: 'Diana Prince',
        roll_no: '203',
        seat_no: null,
        email: null,
        division: 'A',
        level: 'UG',
        total_marks: null,
        total_credits: 20,
        sgpi: null,
        cgpa: null,
        overall_result: 'UNRESOLVED',
      },
      total_enrolled: 1,
      passed_count: 0,
      failed_count: 0,
      unresolved_count: 1,
      subjects: [
        {
          course_code: 'CSC303',
          course_name: 'Operating Systems',
          kind: 'theory',
          credits: 4,
          components: {
            IA: { component: 'IA', marks: null, flag: 'ABS', state: 'flagged', raw_text: 'ABS' },
          },
          total_marks: null,
          computed_marks_sum: null,
          total_match: null,
          letter_grade: null,
          recorded_result: 'unresolved',
          flags: ['ABSENT_IN_COMPONENT'],
          is_absent: true,
          has_missing_marks: true,
          has_uncalculated_total: true,
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/students/STU003']}>
        <Routes>
          <Route path="/students/:identifier" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Diana Prince')).toBeInTheDocument()
      expect(screen.getByText('Operating Systems')).toBeInTheDocument()
    })

    expect(screen.getAllByText(/unresolved/i).length).toBeGreaterThan(0)
    expect(screen.getByText('ABSENT_IN_COMPONENT')).toBeInTheDocument()
  })

  it('handles 409 ambiguous resolution by opening DisambiguationModal', async () => {
    const error409 = new ApiError(
      409,
      'AMBIGUOUS_STUDENT_QUERY',
      'Query matches multiple students',
      [],
      [
        { student_id: 'STU_10', name: 'Rohan Patil', roll_no: '10', seat_no: 'S1', division: 'A' },
        { student_id: 'STU_11', name: 'Rohan Patil', roll_no: '11', seat_no: 'S2', division: 'B' },
      ],
      'Patil'
    )

    vi.spyOn(client, 'getStudentBreakdown').mockRejectedValue(error409)

    render(
      <MemoryRouter initialEntries={['/students/Patil']}>
        <Routes>
          <Route path="/students/:identifier" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Multiple Students Matched')).toBeInTheDocument()
    })

    expect(screen.getByText(/matched multiple student records/i)).toBeInTheDocument()
    expect(screen.getAllByText('Rohan Patil')).toHaveLength(2)
  })

  it('renders student not found state on HTTP 404', async () => {
    const error404 = new ApiError(404, 'STUDENT_NOT_FOUND', 'Student record not found')
    vi.spyOn(client, 'getStudentBreakdown').mockRejectedValue(error404)

    render(
      <MemoryRouter initialEntries={['/students/NON_EXISTENT']}>
        <Routes>
          <Route path="/students/:identifier" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Student Record Not Found')).toBeInTheDocument()
      expect(screen.getByText(/NON_EXISTENT/)).toBeInTheDocument()
    })
  })

  it('navigates to selected candidate when disambiguation candidate is picked', async () => {
    const error409 = new ApiError(
      409,
      'AMBIGUOUS_STUDENT_QUERY',
      'Query matches multiple students',
      [],
      [
        { student_id: 'STU_10', name: 'Rohan Patil', roll_no: '10', seat_no: 'S1', division: 'A' },
        { student_id: 'STU_11', name: 'Rohan Patil', roll_no: '11', seat_no: 'S2', division: 'B' },
      ],
      'Patil'
    )

    const mockBreakdown = {
      status: 'success',
      query: 'STU_10',
      student: {
        student_id: 'STU_10',
        name: 'Rohan Patil',
        roll_no: '10',
        seat_no: 'S1',
        email: null,
        division: 'A',
        level: 'UG',
        total_marks: 400,
        total_credits: 20,
        sgpi: 8.0,
        cgpa: 8.0,
        overall_result: 'PASS',
      },
      total_enrolled: 1,
      passed_count: 1,
      failed_count: 0,
      unresolved_count: 0,
      subjects: [],
    }

    vi.spyOn(client, 'getStudentBreakdown')
      .mockRejectedValueOnce(error409)
      .mockResolvedValueOnce(mockBreakdown as any)

    render(
      <MemoryRouter initialEntries={['/students/Patil']}>
        <Routes>
          <Route path="/students/:identifier" element={<StudentDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Multiple Students Matched')).toBeInTheDocument()
    })

    // Click first candidate
    const candidateButtons = screen.getAllByRole('button', { name: /Rohan Patil/i })
    expect(candidateButtons.length).toBeGreaterThan(0)
    candidateButtons[0].click()

    await waitFor(() => {
      expect(screen.queryByText('Multiple Students Matched')).not.toBeInTheDocument()
      expect(screen.getByText('Rohan Patil')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('S1')).toBeInTheDocument()
    })
  })
})


