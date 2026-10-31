import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FollowUpsPage } from './FollowUpsPage'
import * as client from '../api/client'

const mockFailedStudents = [
  ...Array.from({ length: 7 }, (_, i) => ({
    student_id: `FAIL_1_${i + 1}`,
    seat_no: `SEAT_A${10 + i}`,
    roll_no: `${10 + i}`,
    name: `Student ${10 + i}`,
    division: 'A',
    failed_subject_count: 1,
    overall_result: 'FAIL',
    total_marks: 400,
    sgpi: null,
    cgpa: null,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    student_id: `FAIL_4_${i + 1}`,
    seat_no: `SEAT_B${70 + i}`,
    roll_no: `${70 + i}`,
    name: `Student ${70 + i}`,
    division: 'B',
    failed_subject_count: 7,
    overall_result: 'FAIL',
    total_marks: 250,
    sgpi: null,
    cgpa: null,
  })),
]

const mockTopStudents = [
  {
    student_id: 'TOP_1',
    seat_no: 'SEAT_A01',
    roll_no: '1',
    name: 'Student 01',
    division: 'A',
    failed_subject_count: 0,
    overall_result: 'PASS',
    total_marks: 680,
    sgpi: 9.8,
    cgpa: 9.85,
  },
  {
    student_id: 'TOP_2',
    seat_no: 'SEAT_B01',
    roll_no: '101',
    name: 'Student 101',
    division: 'B',
    failed_subject_count: 0,
    overall_result: 'PASS',
    total_marks: 670,
    sgpi: 9.7,
    cgpa: 9.75,
  },
]

const mockAbsentStudents = [
  {
    student_id: 'ABS_1',
    seat_no: 'SEAT_A08',
    roll_no: '8',
    name: 'Student 08',
    division: 'A',
    course_code: 'PEEC07T',
    component: 'TH',
    status: 'ABSENT',
  },
]

describe('FollowUpsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getStudents').mockImplementation(async (params) => {
      if (params?.result === 'FAIL') {
        return { items: mockFailedStudents, total: mockFailedStudents.length, limit: 100, offset: 0 } as any
      }
      return { items: mockTopStudents, total: mockTopStudents.length, limit: 30, offset: 0 } as any
    })
    vi.spyOn(client, 'getAbsentStudents').mockResolvedValue({
      items: mockAbsentStudents,
      total: mockAbsentStudents.length,
      limit: 50,
      offset: 0,
    } as any)
    vi.spyOn(client, 'getEarlyWarningStudents').mockResolvedValue({
      at_risk_students: [],
      total_at_risk: 0,
      risk_factors_summary: [],
    } as any)
  })

  it('renders 3 main tabs and displays failed groupings with inferred pass rule', async () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    // Wait for async student loads
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Failed Students \(13\)/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Remedial Peer Pairing/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Intervention Notices/i })).toBeInTheDocument()

    // Tab 1 content
    expect(screen.getByText(/Failed in 1–3 Subjects \(ATKT Eligible\)/i)).toBeInTheDocument()
    expect(screen.getByText('7 Students')).toBeInTheDocument()
    expect(screen.getByText(/Failed in 4\+ Subjects \(Critical Backlog\)/i)).toBeInTheDocument()
    expect(screen.getByText('6 Students')).toBeInTheDocument()
    expect(screen.getByText(/Pass Rule Configuration/i)).toBeInTheDocument()
    expect(screen.getByText(/Configurable in Settings \[Inferred\]/i)).toBeInTheDocument()
  })

  it('switches to Remedial Peer Pairing tab and renders paired mentors', async () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remedial Peer Pairing/i })).toBeInTheDocument()
    })

    // Click Remedial Peer Pairing tab
    fireEvent.click(screen.getByRole('button', { name: /Remedial Peer Pairing/i }))

    expect(screen.getByText('Deterministic Remedial Peer Assignment')).toBeInTheDocument()
    expect(screen.getAllByText(/Struggling Candidate/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Assigned Peer Mentor/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Export Pairing \(CSV\)/i })).toBeInTheDocument()
  })

  it('switches to Intervention Notices tab, allows selecting templates, and previews notice text', async () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Intervention Notices/i })).toBeInTheDocument()
    })

    // Click Intervention Notices tab
    fireEvent.click(screen.getByRole('button', { name: /Intervention Notices/i }))

    expect(screen.getByText('Generated Notice Preview')).toBeInTheDocument()
    expect(screen.getByText(/ACADEMIC REMEDIAL INTERVENTION NOTICE/i)).toBeInTheDocument()

    // Switch to Absentee Make-up Notice template
    fireEvent.click(screen.getByText('Absentee Make-up Notice'))
    expect(screen.getByText(/ABSENTEE MAKE-UP EXAMINATION NOTIFICATION/i)).toBeInTheDocument()

    // Switch to College Merit List Letter template
    fireEvent.click(screen.getByText("College Merit List Letter"))
    expect(screen.getByText(/CONGRATULATORY LETTER — COLLEGE MERIT LIST/i)).toBeInTheDocument()

    // Export CSV (Mail Merge) button
    expect(screen.getByRole('button', { name: /Export CSV \(Mail Merge\)/i })).toBeInTheDocument()
  })
})
