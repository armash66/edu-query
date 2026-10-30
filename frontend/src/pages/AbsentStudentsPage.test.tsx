import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AbsentStudentsPage } from './AbsentStudentsPage'
import * as client from '../api/client'
import * as excelExport from '../utils/excelExport'
import { ApiError } from '../api/types'

describe('AbsentStudentsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getSubjects').mockResolvedValue({
      total: 2,
      limit: 100,
      offset: 0,
      items: [
        {
          code: 'CS101',
          name: 'Computer Networks',
          kind: 'Theory',
          credits: 4,
          components: ['ESE', 'MSE'],
          enrolled_students_count: 50,
        },
        {
          code: 'CS102',
          name: 'Database Systems',
          kind: 'Practical',
          credits: 2,
          components: ['LAB'],
          enrolled_students_count: 50,
        },
      ],
    })
    vi.spyOn(client, 'getAbsentComponents').mockResolvedValue(['ESE', 'MSE', 'LAB'])
  })

  it('renders absent student records with markers, component, and subject counts', async () => {
    vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      total: 2,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          name: 'Charlie Brown',
          division: 'A',
          course_code: 'CS101',
          course_name: 'Computer Networks',
          component: 'ESE',
          raw_text: 'AB',
          marks: null,
          total_marks: 380,
          overall_result: 'FAIL',
          passed_subject_count: 4,
          failed_subject_count: 1,
          absent_subject_count: 1,
        },
        {
          student_id: 'STU002',
          roll_no: '102',
          seat_no: 'SEAT_B2',
          name: 'Dana Scully',
          division: 'B',
          course_code: 'CS102',
          course_name: 'Database Systems',
          component: 'LAB',
          raw_text: 'ABSENT',
          marks: null,
          total_marks: 410,
          overall_result: 'PASS',
          passed_subject_count: 5,
          failed_subject_count: 0,
          absent_subject_count: 1,
        },
      ],
    })

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Fetching absent records from database/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
      expect(screen.getByText('Dana Scully')).toBeInTheDocument()
    })

    // Check subjects and components
    expect(screen.getAllByText('CS101').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('CS102').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ESE').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('LAB').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('AB')).toBeInTheDocument()
    expect(screen.getByText('ABSENT')).toBeInTheDocument()

    // Check KPI overview cards and results
    expect(screen.getByText('Absent Students')).toBeInTheDocument()
    expect(screen.getByText('Absence Incidents')).toBeInTheDocument()
    expect(screen.getAllByText('FAIL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PASS').length).toBeGreaterThanOrEqual(1)
  })

  it('filters absent records by division, subject, and search query', async () => {
    const getAbsentStudentsSpy = vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          name: 'Charlie Brown',
          division: 'A',
          course_code: 'CS101',
          course_name: 'Computer Networks',
          component: 'ESE',
          raw_text: 'AB',
          marks: null,
          total_marks: 380,
          overall_result: 'FAIL',
          passed_subject_count: 4,
          failed_subject_count: 1,
          absent_subject_count: 1,
        },
      ],
    })

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    })

    // Change division filter
    const divTrigger = screen.getByLabelText(/filter by division/i)
    fireEvent.click(divTrigger)
    const option = screen.getByRole('option', { name: /Division A/i })
    fireEvent.click(option)

    await waitFor(() => {
      expect(getAbsentStudentsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ division: 'A' }),
        expect.any(AbortSignal)
      )
    })
  })

  it('triggers Excel export on button click', async () => {
    vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          name: 'Charlie Brown',
          division: 'A',
          course_code: 'CS101',
          course_name: 'Computer Networks',
          component: 'ESE',
          raw_text: 'AB',
          marks: null,
          total_marks: 380,
          overall_result: 'FAIL',
          passed_subject_count: 4,
          failed_subject_count: 1,
          absent_subject_count: 1,
        },
      ],
    })
    const exportSpy = vi.spyOn(excelExport, 'exportAbsentStudents').mockReturnValue({
      workbook: {} as any,
      blob: new Blob(['fake-xlsx']),
      filename: 'EduQuery_Absent_Students_Roster.xlsx',
    })

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    })

    const exportBtn = screen.getByTitle(/export filtered absent records to excel/i)
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Charlie Brown' })
        ]),
        false
      )
    })
  })

  it('renders error banner with retry option on API failure', async () => {
    vi.spyOn(client, 'getAbsentStudents').mockRejectedValue(
      new ApiError(500, 'SERVER_ERROR', 'Database query failed')
    )

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Could not load absent student records/i)).toBeInTheDocument()
      expect(screen.getByText(/Database query failed/i)).toBeInTheDocument()
    })
  })

  it('triggers window.print when Print Roster button is clicked', async () => {
    window.print = vi.fn()
    vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          name: 'Charlie Brown',
          division: 'A',
          course_code: 'CS101',
          course_name: 'Computer Networks',
          component: 'ESE',
          raw_text: 'AB',
          marks: null,
          total_marks: 380,
          overall_result: 'FAIL',
          passed_subject_count: 4,
          failed_subject_count: 1,
          absent_subject_count: 1,
        },
      ],
    })

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    })

    const printBtn = screen.getByRole('button', { name: /print roster/i })
    fireEvent.click(printBtn)

    await waitFor(() => {
      expect(window.print).toHaveBeenCalled()
    })
  })

  it('renders absence severity groups (1-2 subjects vs 5+ subjects) and Draft Notice action', async () => {
    vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [],
    })

    render(
      <MemoryRouter>
        <AbsentStudentsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Absent in 1–2 Subjects')).toBeInTheDocument()
    expect(screen.getByText('Absent in 5+ Subjects (Critical)')).toBeInTheDocument()
    expect(screen.getByText('Draft Notice')).toBeInTheDocument()
  })

})
