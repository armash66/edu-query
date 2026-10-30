import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  ArrowUpRight,
  Download,
  Printer,
  Award,
  List,
  Info,
} from 'lucide-react'
import { getStudents, saveBlobAsFile, downloadStudentsRosterExcel, type StudentListParams } from '../api/client'
import { exportStudentsRoster } from '../utils/excelExport'
import { ApiError, type StudentSummaryItem, type PaginatedResponse } from '../api/types'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import { SearchField } from '../ui/SearchField'
import { DataTable, type Column } from '../ui/DataTable'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Listbox } from '../ui/Listbox'
import { Tabs } from '../ui/Tabs'
import { toTitleCase } from '../utils/text'

export const StudentsPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [students, setStudents] = useState<StudentSummaryItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // Active Tab: 'list' or 'merit'
  const [activeTab, setActiveTab] = useState<'list' | 'merit'>('list')

  // Preset chip filter: 'all' | 'failed' | 'absent' | 'div_a' | 'div_b' | 'ug' | 'dsy' | 'toppers'
  const initialPreset = searchParams.get('preset') || 'all'
  const [activePreset, setActivePreset] = useState<string>(
    initialPreset === 'absent' ? 'absent' : initialPreset === 'failed' ? 'failed' : 'all'
  )

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [resultFilter, setResultFilter] = useState<string>(
    initialPreset === 'absent' ? '' : ''
  )
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [hasAbsencesFilter, setHasAbsencesFilter] = useState<boolean | undefined>(
    initialPreset === 'absent' ? true : undefined
  )
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)

  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Export & Print State
  const [exporting, setExporting] = useState<boolean>(false)
  const [printing, setPrinting] = useState<boolean>(false)

  // Abort controller to cancel obsolete in-flight searches
  const abortControllerRef = useRef<AbortController | null>(null)

  // Synchronize preset chip with filters
  const applyPreset = (preset: string) => {
    setActivePreset(preset)
    setPage(1)
    if (preset === 'all') {
      setResultFilter('')
      setDivisionFilter('')
      setLevelFilter('')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'failed') {
      setResultFilter('FAIL')
      setDivisionFilter('')
      setLevelFilter('')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'absent') {
      setResultFilter('')
      setDivisionFilter('')
      setLevelFilter('')
      setHasAbsencesFilter(true)
      setSortBy(undefined)
    } else if (preset === 'div_a') {
      setResultFilter('')
      setDivisionFilter('A')
      setLevelFilter('')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'div_b') {
      setResultFilter('')
      setDivisionFilter('B')
      setLevelFilter('')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'ug') {
      setResultFilter('')
      setDivisionFilter('')
      setLevelFilter('UG')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'dsy') {
      setResultFilter('')
      setDivisionFilter('')
      setLevelFilter('DSY')
      setHasAbsencesFilter(undefined)
      setSortBy(undefined)
    } else if (preset === 'toppers') {
      setResultFilter('')
      setDivisionFilter('')
      setLevelFilter('')
      setHasAbsencesFilter(undefined)
      setSortBy('toppers')
    }
  }

  const fetchStudentList = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const params: StudentListParams = {
      query: searchQuery.trim() || undefined,
      division: divisionFilter.trim() || undefined,
      result: resultFilter.trim() || undefined,
      has_absences: hasAbsencesFilter,
      level: levelFilter.trim() || undefined,
      sort_by: activeTab === 'merit' ? 'merit' : sortBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    try {
      const data: PaginatedResponse<StudentSummaryItem> = await getStudents(
        params,
        controller.signal
      )
      setStudents(data.items || [])
      setTotal(data.total || 0)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      if (err instanceof ApiError) {
        setError(err)
      } else {
        const msg = err instanceof Error ? err.message : 'Database query error'
        setError(new ApiError(0, 'CLIENT_ERROR', msg))
      }
    } finally {
      setLoading(false)
    }
  }, [searchQuery, divisionFilter, resultFilter, hasAbsencesFilter, levelFilter, sortBy, activeTab, page, pageSize])

  useEffect(() => {
    fetchStudentList()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchStudentList])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      try {
        const blob = await downloadStudentsRosterExcel({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          result: resultFilter.trim() || undefined,
        })
        saveBlobAsFile(blob, activeTab === 'merit' ? 'EduQuery_Merit_List.xlsx' : 'EduQuery_Students.xlsx')
        return
      } catch (serverErr) {
        console.warn('Server-side xlsx export failed, falling back to client CSV export', serverErr)
      }

      let recordsToExport: StudentSummaryItem[] = []
      if (total <= 200) {
        const allData = await getStudents({
          query: searchQuery.trim() || undefined,
          division: divisionFilter.trim() || undefined,
          result: resultFilter.trim() || undefined,
          has_absences: hasAbsencesFilter,
          level: levelFilter.trim() || undefined,
          sort_by: activeTab === 'merit' ? 'merit' : sortBy,
          limit: 200,
          offset: 0,
        })
        recordsToExport = allData.items || []
      } else {
        recordsToExport = students
      }

      const { blob, filename } = exportStudentsRoster(recordsToExport, false)
      saveBlobAsFile(blob, filename)
    } catch {
      alert('Failed to generate export.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 150)
  }

  const columns: Column<StudentSummaryItem>[] = [
    ...(activeTab === 'merit'
      ? [
          {
            key: 'rank',
            header: 'Rank',
            width: '60px',
            align: 'center' as const,
            render: (_row: StudentSummaryItem, idx: number) => (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 'var(--text-xs)',
                  color: (page - 1) * pageSize + idx + 1 <= 3 ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                #{(page - 1) * pageSize + idx + 1}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'seat_no',
      header: 'Seat No',
      width: '95px',
      sticky: true,
      sortable: true,
      render: (row) => (
        <span className="font-mono" style={{ fontWeight: 600 }}>
          {row.seat_no || '—'}
        </span>
      ),
    },
    {
      key: 'roll_no',
      header: 'Roll No',
      width: '95px',
      sortable: true,
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ color: 'var(--text-secondary)' }}>
          {row.roll_no || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      minWidth: '160px',
      maxWidth: '260px',
      wrap: true,
      sortable: true,
      render: (row) => (
        <div style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }} title={row.name}>
          {toTitleCase(row.name)}
        </div>
      ),
    },
    {
      key: 'division',
      header: 'Div',
      width: '55px',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
          }}
        >
          {row.division || '—'}
        </span>
      ),
    },
    {
      key: 'total_marks',
      header: 'Total Marks',
      width: '90px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono">
          {row.total_marks !== null && row.total_marks !== undefined ? row.total_marks : '—'}
        </span>
      ),
    },
    {
      key: 'sgpi',
      header: 'SGPI',
      width: '70px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
          {row.sgpi !== null && row.sgpi !== undefined ? Number(row.sgpi).toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'cgpa',
      header: 'CGPA',
      width: '70px',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-mono" style={{ fontWeight: 600 }}>
          {row.cgpa !== null && row.cgpa !== undefined ? Number(row.cgpa).toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'overall_result',
      header: 'Result',
      width: '90px',
      sortable: true,
      align: 'center',
      render: (row) => {
        const res = (row.overall_result || '').toUpperCase()
        if (res === 'PASS' || res === 'PASSED') {
          return <StatusBadge tone="pass" size="sm" label="Passed" />
        }
        if (res === 'FAIL' || res === 'FAILED') {
          return <StatusBadge tone="fail" size="sm" label="Failed" />
        }
        return <StatusBadge tone="warn" size="sm" label={res || 'Pending'} />
      },
    },
    {
      key: 'actions',
      header: '',
      width: '105px',
      align: 'right',
      render: (row) => (
        <Link
          to={`/students/${row.student_id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Result Slip</span>
          <ArrowUpRight size={12} />
        </Link>
      ),
    },
  ]

  const divisionOptions = [
    { value: '', label: 'All Divisions' },
    { value: 'A', label: 'Division A' },
    { value: 'B', label: 'Division B' },
    { value: 'C', label: 'Division C' },
    { value: 'D', label: 'Division D' },
  ]

  const resultOptions = [
    { value: '', label: 'All Results' },
    { value: 'PASS', label: 'Pass Only' },
    { value: 'FAIL', label: 'Fail / Backlog' },
  ]

  const presetChips = [
    { id: 'all', label: 'All Students' },
    { id: 'failed', label: 'Failed' },
    { id: 'absent', label: 'With Absences' },
    { id: 'div_a', label: 'Division A' },
    { id: 'div_b', label: 'Division B' },
    { id: 'ug', label: 'Regular UG' },
    { id: 'dsy', label: 'DSY' },
    { id: 'toppers', label: 'Toppers' },
  ]

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      {/* Header & Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginBottom: '2px',
            }}
          >
            <Users size={14} />
            <span>Cohort Roster Directory</span>
          </div>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Student Performance Directory
          </h1>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Inspect individual student scores, SGPI marks, division assignments, and backlogs.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button
            size="sm"
            variant="secondary"
            loading={exporting}
            onClick={handleExportExcel}
            icon={<Download size={14} />}
          >
            Export to Excel
          </Button>

          <Button
            size="sm"
            variant="secondary"
            loading={printing}
            onClick={handlePrint}
            icon={<Printer size={14} />}
          >
            Print Roster
          </Button>
        </div>
      </div>

      {/* Tabs: List | Merit List */}
      <Tabs
        items={[
          { id: 'list', label: 'Student Directory', icon: <List size={14} /> },
          { id: 'merit', label: 'Merit List', icon: <Award size={14} /> },
        ]}
        activeId={activeTab}
        onChange={(tabId) => {
          setActiveTab(tabId as 'list' | 'merit')
          setPage(1)
        }}
      />

      {/* Merit List Documented Tie-Break Policy Alert */}
      {activeTab === 'merit' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text)' }}>Documented Tie-Break Rule:</strong> Cohort candidates are
            ranked by cumulative CGPA in descending order. Ties are deterministically resolved by semester SGPI
            descending, then aggregate marks descending, then examination seat number.
          </div>
        </div>
      )}

      {/* Preset Chips (in List view) */}
      {activeTab === 'list' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {presetChips.map((chip) => {
            const isSelected = activePreset === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyPreset(chip.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--surface-active)' : 'var(--surface-hover)',
                  color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Filter Toolbar with Custom Listbox Only */}
      <GlassCard variant="glass-1" padding="sm">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          {/* Search Field */}
          <div style={{ flex: '1 1 280px', maxWidth: '420px' }}>
            <SearchField
              placeholder="Search student name, seat no, roll no..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onClear={() => handleSearchChange('')}
            />
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* Division Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '150px' }}>
              <Listbox
                options={divisionOptions}
                value={divisionFilter}
                onChange={(val) => {
                  setDivisionFilter(val)
                  setActivePreset('custom')
                  setPage(1)
                }}
                size="sm"
                ariaLabel="Filter by division"
              />
            </div>

            {/* Result Selector (only in list view) */}
            {activeTab === 'list' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: '150px' }}>
                <Listbox
                  options={resultOptions}
                  value={resultFilter}
                  onChange={(val) => {
                    setResultFilter(val)
                    setActivePreset('custom')
                    setPage(1)
                  }}
                  size="sm"
                  ariaLabel="Filter by result status"
                />
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Main Table / State View */}
      {loading ? (
        <GlassCard variant="glass-2" padding="xl" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
            <svg
              style={{ width: '28px', height: '28px', animation: 'spin 1s linear infinite' }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 60" />
            </svg>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Fetching student roster from database...
            </span>
          </div>
        </GlassCard>
      ) : error ? (
        <ErrorState
          title="Could not load student roster"
          message={error.message || 'Database query error'}
          onRetry={fetchStudentList}
          retryLabel="Retry"
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="No Students Found"
          description="There are no student records matching your current filter criteria."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                applyPreset('all')
                setSearchQuery('')
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={students}
          keyExtractor={(row) => row.student_id}
          pageSize={pageSize}
          serverTotal={total}
          currentPage={page}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setPage(1)
          }}
          pageSizeOptions={[25, 50, 100]}
          showDensityToggle
          defaultDensity="comfortable"
          onRowClick={(row) => navigate(`/students/${row.student_id}`)}
        />
      )}
    </div>
  )
}

export default StudentsPage
