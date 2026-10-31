import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ExplorePage } from './ExplorePage'
import * as client from '../api/client'
import type {
  InvestigationQueryResponse,
  InvestigationCapabilitiesResponse,
  CourseItem,
  PaginatedResponse,
} from '../api/types'

const mockQueryResponse: InvestigationQueryResponse = {
  total: 2,
  cohort_total: 145,
  limit: 25,
  offset: 0,
  active_explanation: "Showing students where: Division is 'A'",
  items: [
    {
      student_id: 'std_001',
      seat_no: 'S101',
      roll_no: 'R101',
      name: 'John Doe',
      division: 'A',
      level: 'SEM4',
      overall_result: 'PASS',
      total_marks: 485,
      sgpi: 8.5,
      cgpa: 8.2,
    },
    {
      student_id: 'std_002',
      seat_no: 'S102',
      roll_no: 'R102',
      name: 'Jane Smith',
      division: 'B',
      level: 'SEM4',
      overall_result: 'FAIL',
      total_marks: 320,
      sgpi: 4.0,
      cgpa: 5.1,
    },
  ],
}

const mockCapabilities: InvestigationCapabilitiesResponse = {
  status: 'success',
  max_conditions: 10,
  supported_logic: ['AND', 'OR'],
  fields: [
    { field: 'division', label: 'Division', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: ['A', 'B'] },
    { field: 'result', label: 'Outcome', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: ['PASSES', 'FAILS'] },
    { field: 'course_code', label: 'Subject', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: ['CS-401'] },
    { field: 'multi_fails', label: 'Failing 2+ Subjects', data_type: 'boolean', supported_operators: ['eq'] },
    { field: 'total_marks', label: 'Total Marks', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
  ],
}

const mockCourses: PaginatedResponse<CourseItem> = {
  total: 1,
  limit: 100,
  offset: 0,
  items: [
    { code: 'CS-401', name: 'Database Management Systems', kind: 'theory', credits: 4, components: [], enrolled_students_count: 60 },
  ],
}

describe('ExplorePage - Interactive Investigation Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders investigation engine header, search bar, presets, and student table', async () => {
    const runQuerySpy = vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue(mockQueryResponse)
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    // Verify investigation builder header & presets
    expect(screen.getByText(/Interactive Academic Investigation Engine/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search by student identifier, name, roll no/i)).toBeInTheDocument()
    expect(screen.getByText(/Failing 2\+ Subjects/i)).toBeInTheDocument()
    expect(screen.getByText(/All Failures/i)).toBeInTheDocument()
    expect(screen.getByText(/Passed Students/i)).toBeInTheDocument()

    // Verify matched record count and active explanation
    expect(screen.getByText(/Showing students where: Division is 'A'/i)).toBeInTheDocument()
    expect(screen.getByText(/145/)).toBeInTheDocument()

    // Verify Excel export button (.xlsx only per policy)
    expect(screen.getByRole('button', { name: /Export to Excel/i })).toBeInTheDocument()

    expect(runQuerySpy).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 0 }),
      expect.anything()
    )
  })

  it('updates parameters and applies condition when a quick preset is clicked', async () => {
    const runQuerySpy = vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue(mockQueryResponse)
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const multiFailsBtn = screen.getByText(/Failing 2\+ Subjects/i)
    fireEvent.click(multiFailsBtn)

    await waitFor(() => {
      expect(runQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({
            conditions: expect.arrayContaining([
              expect.objectContaining({ field: 'multi_fails', operator: 'eq', value: true }),
            ]),
          }),
        }),
        expect.anything()
      )
    })
  })

  it('toggles filter builder open and allows adding custom conditions', async () => {
    vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue(mockQueryResponse)
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const filterBuilderToggle = screen.getByRole('button', { name: /Filter Builder/i })
    fireEvent.click(filterBuilderToggle)

    expect(screen.getByText(/Investigation Query Builder/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Match ALL \(AND\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Match ANY \(OR\)/i })).toBeInTheDocument()

    const addConditionBtn = screen.getByRole('button', { name: /Add Condition/i })
    fireEvent.click(addConditionBtn)

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument()
    })
  })

  it('displays empty state message when no records match filters', async () => {
    vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue({
      total: 0,
      cohort_total: 145,
      limit: 25,
      offset: 0,
      active_explanation: 'Showing students where: Division is Z',
      items: [],
    })
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore?query=NonExistent']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No records match the active investigation conditions/i)).toBeInTheDocument()
    })
  })

  it('opens Level 2 Add Filter editor, applies a single condition, displays chip, and allows removal', async () => {
    const runQuerySpy = vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue(mockQueryResponse)
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click Level 2 "Add Filter"
    const addFilterBtn = screen.getByRole('button', { name: /Add Filter/i })
    fireEvent.click(addFilterBtn)

    expect(screen.getByText(/Add Investigation Filter Condition/i)).toBeInTheDocument()

    // Click "Apply Filter"
    const applyBtn = screen.getByRole('button', { name: /Apply Filter/i })
    fireEvent.click(applyBtn)

    // Verify condition chip is rendered
    await waitFor(() => {
      expect(screen.getByText(/Active Filters:/i)).toBeInTheDocument()
      expect(screen.getByText(/Division is A/i)).toBeInTheDocument()
      expect(runQuerySpy).toHaveBeenCalled()
    })

    // Remove the filter chip
    const removeChip = screen.getByTitle('Remove filter')
    fireEvent.click(removeChip)

    await waitFor(() => {
      expect(screen.queryByText(/Division is A/i)).not.toBeInTheDocument()
    })
  })

  it('renders Ask AI interpretation banner when source=ai is passed in URL', async () => {
    vi.spyOn(client, 'runInvestigationQuery').mockResolvedValue(mockQueryResponse)
    vi.spyOn(client, 'getInvestigationCapabilities').mockResolvedValue(mockCapabilities)
    vi.spyOn(client, 'getSubjects').mockResolvedValue(mockCourses)

    render(
      <MemoryRouter initialEntries={['/explore?source=ai&division=A']}>
        <ExplorePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Interpreted from Ask AI query/i)).toBeInTheDocument()
      expect(screen.getByText(/Natural language translated into predicate filter conditions/i)).toBeInTheDocument()
    })
  })

})
