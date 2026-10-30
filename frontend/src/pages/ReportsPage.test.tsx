import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReportsPage } from './ReportsPage'

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all 6 official academic reports and anonymization toggle', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Check header
    expect(screen.getByText('Institutional Reports')).toBeInTheDocument()

    // Check all 6 reports
    expect(screen.getByText('Result Analysis PDF')).toBeInTheDocument()
    expect(screen.getByText('Cohort Merit List')).toBeInTheDocument()
    expect(screen.getByText('Failed & Absent Action Roster')).toBeInTheDocument()
    expect(screen.getByText('Result Slips (Print / PDF)')).toBeInTheDocument()
    expect(screen.getByText('Department Head Brief')).toBeInTheDocument()
    expect(screen.getByText('Student Notices Mail-Merge')).toBeInTheDocument()

    // Check Anonymization toggle
    const toggle = screen.getByLabelText(/Anonymize Exports \(Roll Numbers Only\)/i)
    expect(toggle).not.toBeChecked()

    // Toggle on
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
    expect(screen.getByText(/Anonymization Filter Active/i)).toBeInTheDocument()
  })

  it('triggers window.print when Print Division Slips is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const printBtn = screen.getByRole('button', { name: /Print Division Slips/i })
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
  })
})

