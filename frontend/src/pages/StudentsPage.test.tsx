import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StudentsPage } from './StudentsPage'
import * as client from '../api/client'
import * as excelExport from '../utils/excelExport'
import { ApiError } from '../api/types'

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders student list fetched from API', async () => {
    vi.spyOn(client, 'getStudents').mockResolvedValue({
      total: 2,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          name: 'Alice Johnson',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          division: 'A',
          level: 'UG',
          total_marks: 450,
          overall_result: 'PASS',
          sgpi: 8.5,
          cgpa: 8.2,
        },
        {
          student_id: 'STU002',
          name: 'Bob Smith',
          roll_no: '102',
          seat_no: 'SEAT_B2',
          division: 'B',
          level: 'UG',
          total_marks: 320,
          overall_result: 'FAIL',
          sgpi: 4.8,
          cgpa: 5.1,
        },
      ],
    })

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Fetching student roster from database/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    })

    expect(screen.getAllByText(/passed/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('102')).toBeInTheDocument()
  })

  it('filters students by division and search query', async () => {
    const getStudentsSpy = vi.spyOn(client, 'getStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          name: 'Alice Johnson',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          division: 'A',
          level: 'UG',
          total_marks: 450,
          overall_result: 'PASS',
          sgpi: 8.5,
          cgpa: 8.2,
        },
      ],
    })

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    // Filter by division A
    const divisionSelect = screen.getByLabelText(/filter by division/i)
    fireEvent.change(divisionSelect, { target: { value: 'A' } })

    await waitFor(() => {
      expect(getStudentsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ division: 'A' }),
        expect.any(AbortSignal)
      )
    })
  })

  it('renders empty state when no students found', async () => {
    vi.spyOn(client, 'getStudents').mockResolvedValue({
      total: 0,
      limit: 25,
      offset: 0,
      items: [],
    })

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No Students Found')).toBeInTheDocument()
    })
  })

  it('renders error banner with retry option on API failure', async () => {
    const errorSpy = vi.spyOn(client, 'getStudents').mockRejectedValue(
      new ApiError(500, 'INTERNAL_ERROR', 'Database query error')
    )

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Could not load student roster/i)).toBeInTheDocument()
      expect(screen.getByText(/Database query error/i)).toBeInTheDocument()
    })

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)

    expect(errorSpy).toHaveBeenCalledTimes(2)
  })

  it('triggers SheetJS Excel export on Export to Excel button click', async () => {
    vi.spyOn(client, 'getStudents').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          student_id: 'STU001',
          name: 'Alice Johnson',
          roll_no: '101',
          seat_no: 'SEAT_A1',
          division: 'A',
          level: 'UG',
          total_marks: 450,
          overall_result: 'PASS',
          sgpi: 8.5,
          cgpa: 8.2,
        },
      ],
    })

    const exportSpy = vi.spyOn(excelExport, 'exportStudentsRoster').mockReturnValue({
      workbook: {} as any,
      blob: new Blob(['fake-xlsx']),
      filename: 'EduQuery_Students.xlsx',
    })

    render(
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole('button', { name: /export to excel/i })
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Alice Johnson' })
        ]),
        false
      )
    })
  })
})
