import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DisambiguationModal } from './DisambiguationModal'
import { ConfirmDialog } from './ConfirmDialog'
import type { CandidateSummary } from '../api/types'

describe('Modal Accessibility and Escape handling', () => {
  describe('DisambiguationModal', () => {
    const mockCandidates: CandidateSummary[] = [
      {
        student_id: 'STUDENT_001',
        roll_no: '101',
        seat_no: 'S101',
        name: 'Alice Smith',
        division: 'A',
      },
      {
        student_id: 'STUDENT_002',
        roll_no: '102',
        seat_no: 'S102',
        name: 'Alice Johnson',
        division: 'B',
      },
    ]

    it('renders candidate choices and calls onSelect when clicked', () => {
      const handleSelect = vi.fn()
      const handleClose = vi.fn()

      render(
        <DisambiguationModal
          isOpen={true}
          query="Alice"
          candidates={mockCandidates}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )

      expect(screen.getByText('Multiple Students Matched')).toBeInTheDocument()
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Alice Smith'))
      expect(handleSelect).toHaveBeenCalledWith(mockCandidates[0])
    })

    it('closes on Escape key press', () => {
      const handleClose = vi.fn()

      render(
        <DisambiguationModal
          isOpen={true}
          query="Alice"
          candidates={mockCandidates}
          onSelect={vi.fn()}
          onClose={handleClose}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on backdrop click', () => {
      const handleClose = vi.fn()

      const { container } = render(
        <DisambiguationModal
          isOpen={true}
          query="Alice"
          candidates={mockCandidates}
          onSelect={vi.fn()}
          onClose={handleClose}
        />
      )

      const backdrop = container.querySelector('.modal-backdrop')!
      fireEvent.click(backdrop)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('ConfirmDialog', () => {
    it('renders message and calls onConfirm on action', () => {
      const handleConfirm = vi.fn()
      const handleCancel = vi.fn()

      render(
        <ConfirmDialog
          title="Confirm Activation"
          message="Are you sure you want to promote this dataset?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )

      expect(screen.getByText('Confirm Activation')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      expect(handleConfirm).toHaveBeenCalledTimes(1)
    })

    it('closes on Escape key press when not loading', () => {
      const handleCancel = vi.fn()

      render(
        <ConfirmDialog
          title="Confirm"
          message="Proceed?"
          loading={false}
          onConfirm={vi.fn()}
          onCancel={handleCancel}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleCancel).toHaveBeenCalledTimes(1)
    })

    it('does not close on Escape key press when loading', () => {
      const handleCancel = vi.fn()

      render(
        <ConfirmDialog
          title="Confirm"
          message="Proceed?"
          loading={true}
          onConfirm={vi.fn()}
          onCancel={handleCancel}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(handleCancel).not.toHaveBeenCalled()
    })
  })


})
