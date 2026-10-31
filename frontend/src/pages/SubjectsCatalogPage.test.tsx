import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubjectsCatalogPage } from './SubjectsCatalogPage'
import * as client from '../api/client'

const mockOverview = {
  dataset: { id: 'test', name: 'Test Marksheet', status_label: 'Saved', is_temporary: false, expires_in_minutes: null },
  kpis: {
    total_students: 145,
    total_courses: 27,
    passed_students: 132,
    failed_students: 13,
    absent_students: 7,
    pass_rate_percent: 91.0,
    divisions_count: 2,
    needs_attention_count: 3,
    sgpi_average: 8.8,
    sgpi_median: 8.9,
    students_with_sgpi: 132,
    students_without_sgpi: 13,
  },
  needs_attention: [],
  results: {
    passed: { count: 132, percentage: 91.0 },
    failed: { count: 13, percentage: 9.0 },
    absent: { count: 7, percentage: 4.8 },
    divisions: [],
  },
  sgpi_distribution: { average: 8.8, median: 8.9, students_with_sgpi: 132, students_without_sgpi: 13, bins: [] },
  hardest_subjects: [
    {
      course_code: 'PCEC12T',
      course_title: 'Theory of Computer Science',
      failed_count: 12,
      enrolled_count: 145,
      failure_rate_percent: 8.3,
      tier: 'amber' as const,
    },
  ],
  highlights: [],
}

describe('SubjectsCatalogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(client, 'getOverviewSummary').mockResolvedValue(mockOverview)
  })

  it('renders course catalog list with components and headcounts', async () => {
    vi.spyOn(client, 'getSubjects').mockResolvedValue({
      total: 2,
      limit: 25,
      offset: 0,
      items: [
        {
          code: 'CSC601',
          name: 'Cryptography and System Security',
          kind: 'theory',
          credits: 4,
          components: ['TH', 'IA'],
          enrolled_students_count: 68,
        },
        {
          code: 'CSL601',
          name: 'Security Lab',
          kind: 'practical',
          credits: 1,
          components: ['TW', 'PR'],
          enrolled_students_count: 68,
        },
      ],
    })

    render(
      <MemoryRouter>
        <SubjectsCatalogPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cryptography and System Security')).toBeInTheDocument()
      expect(screen.getByText('Security Lab')).toBeInTheDocument()
    })
  })

  it('filters courses by modality and division', async () => {
    const getSubjectsSpy = vi.spyOn(client, 'getSubjects').mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      items: [
        {
          code: 'CSC601',
          name: 'Cryptography and System Security',
          kind: 'theory',
          credits: 4,
          components: ['TH', 'IA'],
          enrolled_students_count: 68,
        },
      ],
    })

    render(
      <MemoryRouter>
        <SubjectsCatalogPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Cryptography and System Security')).toBeInTheDocument()
    })

    expect(getSubjectsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: undefined,
        division: undefined,
      })
    )
  })

  it('renders catalog summary cards and switches to Electives tab', async () => {
    vi.spyOn(client, 'getSubjects').mockResolvedValue({
      total: 2,
      limit: 25,
      offset: 0,
      items: [
        {
          code: 'MDMBD02',
          name: 'Financial Basics for Engineers and Technopreneurs',
          kind: 'theory',
          credits: 4,
          components: ['TH', 'IA'],
          enrolled_students_count: 3,
        },
        {
          code: 'CSC601',
          name: 'Cryptography and System Security',
          kind: 'theory',
          credits: 4,
          components: ['TH', 'IA'],
          enrolled_students_count: 68,
        },
      ],
    })

    render(
      <MemoryRouter>
        <SubjectsCatalogPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('2 Courses')).toBeInTheDocument()
      expect(screen.getByText('91.0%')).toBeInTheDocument()
      expect(screen.getByText('PCEC12T (12)')).toBeInTheDocument()
    })

    // Click Electives tab
    const electivesTab = screen.getByRole('tab', { name: /Electives/i })
    fireEvent.click(electivesTab)

    expect(screen.getByText(/Elective Subjects/i)).toBeInTheDocument()
    expect(screen.getByText('Financial Basics for Engineers and Technopreneurs')).toBeInTheDocument()
    expect(screen.getAllByText(/Small Cohort/i).length).toBeGreaterThanOrEqual(1)
  })
})
