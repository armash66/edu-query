import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubjectsCatalogPage } from './SubjectsCatalogPage'
import * as client from '../api/client'

describe('SubjectsCatalogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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

    expect(screen.getByText('CSC601')).toBeInTheDocument()
    expect(screen.getByText('CSL601')).toBeInTheDocument()
    expect(screen.getAllByText('68').length).toBeGreaterThanOrEqual(1)
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
          enrolled_students_count: 35,
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

    const modalitySelect = screen.getByLabelText(/filter by modality/i)
    fireEvent.change(modalitySelect, { target: { value: 'theory' } })

    await waitFor(() => {
      expect(getSubjectsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'theory' })
      )
    })
  })
})
