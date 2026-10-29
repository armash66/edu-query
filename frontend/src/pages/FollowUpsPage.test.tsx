import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FollowUpsPage } from './FollowUpsPage'

describe('FollowUpsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3 main tabs and displays failed groupings with inferred pass rule', () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    // Check tabs
    expect(screen.getByRole('button', { name: /Failed Students \(13\)/i })).toBeInTheDocument()
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

  it('switches to Remedial Peer Pairing tab and renders paired mentors', () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    // Click Remedial Peer Pairing tab
    fireEvent.click(screen.getByRole('button', { name: /Remedial Peer Pairing/i }))

    expect(screen.getByText('Deterministic Remedial Peer Assignment')).toBeInTheDocument()
    expect(screen.getAllByText(/Struggling Candidate/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Assigned Peer Mentor/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Export Pairing \(CSV\)/i })).toBeInTheDocument()
  })

  it('switches to Intervention Notices tab, allows selecting templates, and previews notice text', () => {
    render(
      <MemoryRouter>
        <FollowUpsPage />
      </MemoryRouter>
    )

    // Click Intervention Notices tab
    fireEvent.click(screen.getByRole('button', { name: /Intervention Notices/i }))

    expect(screen.getByText('Generated Notice Preview')).toBeInTheDocument()
    expect(screen.getByText(/ACADEMIC REMEDIAL INTERVENTION NOTICE/i)).toBeInTheDocument()

    // Switch to Absentee Make-up Notice template
    fireEvent.click(screen.getByText('Absentee Make-up Notice'))
    expect(screen.getByText(/ABSENTEE MAKE-UP EXAMINATION NOTIFICATION/i)).toBeInTheDocument()

    // Switch to Dean's Merit List Letter template
    fireEvent.click(screen.getByText("Dean's Merit List Letter"))
    expect(screen.getByText(/CONGRATULATORY LETTER — DEAN'S MERIT LIST/i)).toBeInTheDocument()

    // Export CSV (Mail Merge) button
    expect(screen.getByRole('button', { name: /Export CSV \(Mail Merge\)/i })).toBeInTheDocument()
  })
})

