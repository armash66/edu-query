import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SubjectDetailPage } from './SubjectDetailPage'
import * as client from '../api/client'

describe('SubjectDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders passed and failed students together in unified table with pass rate explanation', async () => {
    vi.spyOn(client, 'getSubjectStudents').mockResolvedValue({
      course_code: 'CSC501',
      course_name: 'Software Engineering',
      kind: 'theory',
      credits: 3,
      total_enrolled: 65,
      passed_count: 62,
      failed_count: 2,
      absent_count: 1,
      unresolved_count: 0,
      pass_percentage: 96.9,
      denominator_explanation: 'Pass rate calculated as Passed / (Passed + Failed) excluding absent or unclassified records.',
      students: [
        {
          student_id: 'STU001',
          roll_no: '01',
          seat_no: 'SEAT_01',
          name: 'Alice Johnson',
          division: 'A',
          components: {
            TH: { component: 'TH', marks: 65, flag: null, state: 'marked', raw_text: null },
            IA: { component: 'IA', marks: 18, flag: null, state: 'marked', raw_text: null },
          },
          total_marks: 83,
          max_marks: 100,
          status: 'Passed',
          letter_grade: 'O',
          is_absent: false,
          warning: null,
          failure_reason: null,
        },
        {
          student_id: 'STU050',
          roll_no: '50',
          seat_no: 'SEAT_50',
          name: 'Edward Norton',
          division: 'A',
          components: {
            TH: { component: 'TH', marks: 20, flag: null, state: 'marked', raw_text: null },
            IA: { component: 'IA', marks: 8, flag: null, state: 'marked', raw_text: null },
          },
          total_marks: 28,
          max_marks: 100,
          status: 'Failed',
          letter_grade: 'F',
          is_absent: false,
          warning: null,
          failure_reason: 'Below passing threshold',
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/subjects/CSC501']}>
        <Routes>
          <Route path="/subjects/:courseCode" element={<SubjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Software Engineering')).toBeInTheDocument()
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Edward Norton')).toBeInTheDocument()
    })

    // Both passed and failed in the same table
    expect(screen.getByText('CSC501')).toBeInTheDocument()
    expect(screen.getByText(/96\.9%/)).toBeInTheDocument()
    expect(screen.getByText('Passed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('83')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText(/Pass rate calculated as Passed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    expect(screen.getByTitle(/Download complete subject enrollment as Excel/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Download passed students as Excel/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Download confirmed failed students as Excel/i)).toBeInTheDocument()
  })

  it('triggers Excel export correctly when Download All (.xlsx) is clicked from export menu', async () => {
    vi.spyOn(client, 'getSubjectStudents').mockResolvedValue({
      course_code: 'CSC501',
      course_name: 'Software Engineering',
      kind: 'theory',
      credits: 3,
      total_enrolled: 10,
      passed_count: 8,
      failed_count: 2,
      absent_count: 0,
      unresolved_count: 0,
      pass_percentage: 80.0,
      denominator_explanation: 'Pass rate calculated as Passed / (Passed + Failed) excluding absent or unclassified records.',
      students: [],
    })

    const exportMock = vi.spyOn(client, 'downloadSubjectStudentsExcel').mockResolvedValue(new Blob(['fake-excel-data']))
    const saveMock = vi.spyOn(client, 'saveBlobAsFile').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/subjects/CSC501']}>
        <Routes>
          <Route path="/subjects/:courseCode" element={<SubjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Software Engineering')).toBeInTheDocument()
    })

    const exportMenuBtn = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportMenuBtn)

    const exportBtn = screen.getByTitle(/Download complete subject enrollment as Excel/i)
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(exportMock).toHaveBeenCalledWith('CSC501', 'all', null)
      expect(saveMock).toHaveBeenCalledWith(expect.any(Blob), 'EduQuery_CSC501_All_Students.xlsx')
    })
  })
})
