import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Button,
  IconButton,
  Chip,
  StatusBadge,
  Tabs,
  SegmentedControl,
  Input,
  SearchField,
  Listbox,
  Modal,
  Drawer,
  ProgressBar,
  Stat,
  DataTable,
  OutcomeBar,
  FailureRateBar,
} from '../index'

describe('Monochrome Glass UI Components', () => {
  describe('Button', () => {
    it('renders with default secondary variant and triggers onClick', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click Me</Button>)

      const btn = screen.getByRole('button', { name: 'Click Me' })
      expect(btn).toBeDefined()
      fireEvent.click(btn)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('sets aria-busy and disables button when loading=true', () => {
      const handleClick = vi.fn()
      render(
        <Button loading onClick={handleClick}>
          Submit
        </Button>
      )

      const btn = screen.getByRole('button', { name: 'Submit' })
      expect(btn.getAttribute('aria-busy')).toBe('true')
      expect((btn as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('IconButton', () => {
    it('requires aria-label for accessibility', () => {
      render(<IconButton aria-label="Settings" icon={<span>⚙</span>} />)
      const btn = screen.getByRole('button', { name: 'Settings' })
      expect(btn).toBeDefined()
    })
  })

  describe('Chip', () => {
    it('renders label and handles remove button with accessible label', () => {
      const handleRemove = vi.fn()
      render(
        <Chip onRemove={handleRemove} removeLabel="Remove CS Branch">
          Computer Science
        </Chip>
      )

      expect(screen.getByText('Computer Science')).toBeDefined()
      const removeBtn = screen.getByRole('button', { name: 'Remove CS Branch' })
      fireEvent.click(removeBtn)
      expect(handleRemove).toHaveBeenCalledTimes(1)
    })
  })

  describe('StatusBadge', () => {
    it('renders label and tone with dual icon-text encoding', () => {
      render(<StatusBadge tone="pass" label="Passed" />)
      expect(screen.getByText('Passed')).toBeDefined()
    })
  })

  describe('Tabs', () => {
    it('manages active tab selection and supports keyboard navigation', () => {
      const handleChange = vi.fn()
      render(
        <Tabs
          items={[
            { id: 'tab1', label: 'Tab 1' },
            { id: 'tab2', label: 'Tab 2' },
          ]}
          activeId="tab1"
          onChange={handleChange}
        />
      )

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' })

      expect(tab1.getAttribute('aria-selected')).toBe('true')
      expect(tab2.getAttribute('aria-selected')).toBe('false')

      fireEvent.click(tab2)
      expect(handleChange).toHaveBeenCalledWith('tab2')

      fireEvent.keyDown(tab1, { key: 'ArrowRight' })
      expect(handleChange).toHaveBeenCalledWith('tab2')
    })
  })

  describe('SegmentedControl', () => {
    it('renders options as radiogroup and triggers onChange', () => {
      const handleChange = vi.fn()
      render(
        <SegmentedControl
          value="a"
          onChange={handleChange}
          options={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
          ]}
        />
      )

      const radioA = screen.getByRole('radio', { name: 'Option A' })
      const radioB = screen.getByRole('radio', { name: 'Option B' })

      expect(radioA.getAttribute('aria-checked')).toBe('true')
      expect(radioB.getAttribute('aria-checked')).toBe('false')

      fireEvent.click(radioB)
      expect(handleChange).toHaveBeenCalledWith('b')
    })
  })

  describe('Input & SearchField', () => {
    it('links label to input and shows error message with alert role', () => {
      render(
        <Input label="Student ID" error="Invalid ID format" value="" onChange={() => {}} />
      )

      const input = screen.getByLabelText('Student ID')
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByRole('alert')).toBeDefined()
    })

    it('renders search field with searchbox role', () => {
      render(<SearchField placeholder="Search students..." />)
      expect(screen.getByRole('searchbox')).toBeDefined()
    })
  })

  describe('Listbox', () => {
    it('opens options popover on click and selects option', () => {
      const handleChange = vi.fn()
      render(
        <Listbox
          label="Department"
          value="cs"
          onChange={handleChange}
          options={[
            { value: 'cs', label: 'Computer Science' },
            { value: 'me', label: 'Mechanical Eng' },
          ]}
        />
      )

      const combobox = screen.getByRole('combobox')
      expect(combobox.getAttribute('aria-expanded')).toBe('false')

      fireEvent.click(combobox)
      expect(combobox.getAttribute('aria-expanded')).toBe('true')

      const optionMe = screen.getByRole('option', { name: 'Mechanical Eng' })
      fireEvent.click(optionMe)
      expect(handleChange).toHaveBeenCalledWith('me')
    })
  })

  describe('Modal', () => {
    it('renders dialog when isOpen=true and responds to Escape key', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      )

      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByText('Test Modal')).toBeDefined()

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Drawer', () => {
    it('renders slide-over panel when isOpen=true', () => {
      const handleClose = vi.fn()
      render(
        <Drawer isOpen={true} onClose={handleClose} title="Test Drawer">
          <p>Drawer content</p>
        </Drawer>
      )

      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByText('Test Drawer')).toBeDefined()
    })
  })

  describe('ProgressBar', () => {
    it('sets aria-valuenow and calculates percentage', () => {
      render(<ProgressBar value={75} max={100} showLabel label="Upload Progress" />)
      const bar = screen.getByRole('progressbar')
      expect(bar.getAttribute('aria-valuenow')).toBe('75')
      expect(screen.getByText('75%')).toBeDefined()
    })
  })

  describe('Stat', () => {
    it('displays label, value and delta indicator', () => {
      render(
        <Stat
          label="Enrolled"
          value="1,240"
          delta={{ value: '+5%', direction: 'up' }}
        />
      )

      expect(screen.getByText('Enrolled')).toBeDefined()
      expect(screen.getByText('1,240')).toBeDefined()
      expect(screen.getByText('↑+5%')).toBeDefined()
    })
  })

  describe('DataTable', () => {
    const demoData = [
      { id: 1, name: 'Alice', score: 95 },
      { id: 2, name: 'Bob', score: 70 },
      { id: 3, name: 'Charlie', score: 85 },
    ]

    const columns = [
      { key: 'id', header: 'ID', sortable: true },
      { key: 'name', header: 'Name', sortable: true },
      { key: 'score', header: 'Score', sortable: true },
    ]

    it('renders rows and handles sorting by column header', () => {
      render(
        <DataTable
          columns={columns}
          data={demoData}
          keyExtractor={(row) => row.id}
        />
      )

      expect(screen.getByText('Alice')).toBeDefined()
      expect(screen.getByText('Bob')).toBeDefined()
      expect(screen.getByText('Charlie')).toBeDefined()

      const scoreHeader = screen.getByRole('columnheader', { name: /Score/ })
      expect(scoreHeader.getAttribute('aria-sort')).toBe('none')

      fireEvent.click(scoreHeader)
      expect(scoreHeader.getAttribute('aria-sort')).toBe('ascending')

      fireEvent.click(scoreHeader)
      expect(scoreHeader.getAttribute('aria-sort')).toBe('descending')
    })
  })

  describe('OutcomeBar & FailureRateBar', () => {
    it('renders OutcomeBar with accessible label and segments', () => {
      render(<OutcomeBar passed={80} failed={15} absent={5} />)
      const bar = screen.getByRole('img')
      expect(bar.getAttribute('aria-label')).toContain('Pass: 80')
      expect(bar.getAttribute('aria-label')).toContain('Fail: 15')
    })

    it('renders FailureRateBar with tier and click trigger', () => {
      const handleClick = vi.fn()
      render(
        <FailureRateBar
          subjectCode="CS301"
          subjectName="Operating Systems"
          failureRate={18.5}
          failedStudents={37}
          totalStudents={200}
          onClick={handleClick}
        />
      )

      expect(screen.getByText('CS301')).toBeDefined()
      expect(screen.getByText('18.5%')).toBeDefined()
      fireEvent.click(screen.getByText('CS301'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})
