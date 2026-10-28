import { Listbox } from '../ui/Listbox'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Download,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import {
  getInvestigationCapabilities,
  runInvestigationQuery,
  downloadInvestigationExcel,
  saveBlobAsFile,
  getSubjects,
  ApiError,
} from '../api/client'
import type {
  CourseItem,
  InvestigationCapabilitiesResponse,
  InvestigationCondition,
  InvestigationField,
  InvestigationLogic,
  InvestigationOperator,
  InvestigationQueryRequest,
  InvestigationQueryResponse,
} from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorBanner } from '../components/ErrorBanner'
import { LoadingState } from '../components/LoadingState'

const OPERATOR_LABELS: Record<InvestigationOperator, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gte: 'is at least (>=)',
  lte: 'is at most (<=)',
  between: 'between',
  in: 'in',
}

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Capabilities loaded from dataset
  const [capabilities, setCapabilities] = useState<InvestigationCapabilitiesResponse | null>(null)
  const [courses, setCourses] = useState<CourseItem[]>([])

  // Search input state
  const queryParam = searchParams.get('query') || ''
  const [searchInput, setSearchInput] = useState<string>(queryParam)

  // Investigation Conditions & Logic
  const logicParam = (searchParams.get('logic') as InvestigationLogic) || 'AND'
  const [logic, setLogic] = useState<InvestigationLogic>(logicParam === 'OR' ? 'OR' : 'AND')
  const [conditions, setConditions] = useState<InvestigationCondition[]>([])

  // Level 2: Add Filter Modal / Popover State
  const [addFilterOpen, setAddFilterOpen] = useState<boolean>(false)
  const [newFilterField, setNewFilterField] = useState<InvestigationField>('division')
  const [newFilterOperator, setNewFilterOperator] = useState<InvestigationOperator>('eq')
  const [newFilterValue, setNewFilterValue] = useState<any>('A')

  // Level 3: Advanced Builder mode toggle
  const [builderOpen, setBuilderOpen] = useState<boolean>(false)

  // Sorting and Pagination
  const [sortBy, setSortBy] = useState<any>(searchParams.get('sort_by') || 'division')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('sort_dir') as any) || 'asc')
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10)
  const [offset, setOffset] = useState<number>(isNaN(offsetParam) ? 0 : offsetParam)
  const limit = 25

  // Results & Request State
  const [data, setData] = useState<InvestigationQueryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [exporting, setExporting] = useState<boolean>(false)

  // AbortController reference to cancel obsolete in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // 1. Initial capabilities and catalog fetch
  useEffect(() => {
    let active = true
    Promise.all([
      getInvestigationCapabilities().catch(() => null),
      getSubjects({ limit: 100 }).catch(() => null),
    ]).then(([capsRes, subjRes]) => {
      if (!active) return
      if (capsRes) setCapabilities(capsRes)
      if (subjRes) setCourses(subjRes.items)
    })

    return () => {
      active = false
    }
  }, [])

  // 2. Parse initial conditions from URL search parameters
  useEffect(() => {
    const initialConditions: InvestigationCondition[] = []

    const divParam = searchParams.get('division')
    if (divParam) {
      initialConditions.push({ field: 'division', operator: 'eq', value: divParam })
    }

    const resParam = searchParams.get('result') || searchParams.get('outcome')
    if (resParam) {
      initialConditions.push({ field: 'result', operator: 'eq', value: resParam })
    }

    const courseParam = searchParams.get('course') || searchParams.get('course_code')
    if (courseParam) {
      initialConditions.push({ field: 'course_code', operator: 'eq', value: courseParam })
    }

    const multiParam = searchParams.get('multi_fails')
    if (multiParam === 'true') {
      initialConditions.push({ field: 'multi_fails', operator: 'eq', value: true })
    }

    const minFailsParam = searchParams.get('min_fails')
    if (minFailsParam) {
      initialConditions.push({ field: 'failed_subject_count', operator: 'gte', value: parseInt(minFailsParam, 10) })
    }

    const minMarksParam = searchParams.get('min_marks')
    if (minMarksParam) {
      initialConditions.push({ field: 'total_marks', operator: 'gte', value: parseFloat(minMarksParam) })
    }

    const hasAbsentParam = searchParams.get('has_absent')
    if (hasAbsentParam === 'true') {
      initialConditions.push({ field: 'has_absent', operator: 'eq', value: true })
    } else if (hasAbsentParam === 'false') {
      initialConditions.push({ field: 'has_absent', operator: 'eq', value: false })
    }

    const minAbsentParam = searchParams.get('min_absent')
    if (minAbsentParam) {
      initialConditions.push({ field: 'absent_subject_count', operator: 'gte', value: parseInt(minAbsentParam, 10) })
    }

    if (initialConditions.length > 0) {
      setConditions(initialConditions)
    }
  }, []) // Run once on mount

  // 3. Fetch Investigation query with request cancellation
  const fetchInvestigationResults = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const requestPayload: InvestigationQueryRequest = {
      group:
        conditions.length > 0
          ? {
              logic,
              conditions: conditions.filter((c) => c.value !== '' && c.value !== null && c.value !== undefined),
            }
          : null,
      search: searchInput.trim() || null,
      sort_by: sortBy,
      sort_dir: sortDir,
      limit,
      offset,
    }

    runInvestigationQuery(requestPayload, controller.signal)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return // Ignore canceled request
        }
        if (err instanceof ApiError) {
          setError(err)
        } else {
          setError(new ApiError(0, 'FETCH_FAILED', 'Failed to execute academic investigation query'))
        }
        setLoading(false)
      })
  }, [conditions, logic, searchInput, sortBy, sortDir, offset])

  useEffect(() => {
    fetchInvestigationResults()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchInvestigationResults])

  // Synchronize URL with active non-sensitive filters
  const updateUrl = (
    newSearch: string,
    newLogic: InvestigationLogic,
    newConditions: InvestigationCondition[],
    newOffset: number,
    newSortBy: string,
    newSortDir: 'asc' | 'desc'
  ) => {
    const next = new URLSearchParams()
    if (newSearch.trim()) next.set('query', newSearch.trim())
    if (newLogic === 'OR') next.set('logic', 'OR')
    if (newOffset > 0) next.set('offset', String(newOffset))
    if (newSortBy !== 'division') next.set('sort_by', newSortBy)
    if (newSortDir !== 'asc') next.set('sort_dir', newSortDir)

    // Sync individual well-known parameters for clean sharing
    for (const c of newConditions) {
      if (c.field === 'division' && c.operator === 'eq') next.set('division', String(c.value))
      if (c.field === 'result' && c.operator === 'eq') next.set('result', String(c.value))
      if (c.field === 'course_code' && c.operator === 'eq') next.set('course', String(c.value))
      if (c.field === 'multi_fails' && c.operator === 'eq' && c.value) next.set('multi_fails', 'true')
      if (c.field === 'has_absent' && c.operator === 'eq') next.set('has_absent', String(c.value))
      if (c.field === 'absent_subject_count' && c.operator === 'gte') next.set('min_absent', String(c.value))
    }

    setSearchParams(next)
  }

  // Level 2 Handlers: Add Filter Single Condition
  const handleOpenAddFilter = () => {
    setNewFilterField('division')
    setNewFilterOperator('eq')
    setNewFilterValue(capabilities?.fields.find((f) => f.field === 'division')?.choices?.[0] || 'A')
    setAddFilterOpen(true)
  }

  const handleFieldChangeForNewFilter = (field: InvestigationField) => {
    setNewFilterField(field)
    const fieldCap = capabilities?.fields.find((f) => f.field === field)
    const defaultOp = fieldCap?.supported_operators[0] || 'eq'
    setNewFilterOperator(defaultOp)

    if (fieldCap?.data_type === 'choice' && fieldCap.choices?.length) {
      setNewFilterValue(fieldCap.choices[0])
    } else if ((field === 'course_code' || field === 'absent_course_code') && courses.length > 0) {
      setNewFilterValue(courses[0].code)
    } else if (fieldCap?.data_type === 'number') {
      setNewFilterValue(fieldCap.min_value ?? 0)
    } else if (fieldCap?.data_type === 'boolean') {
      setNewFilterValue(true)
    } else {
      setNewFilterValue('')
    }
  }

  const handleApplySingleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    // Append condition and filter duplicates on exact field & op
    const nextConditions = [
      ...conditions.filter((c) => !(c.field === newFilterField && c.operator === newFilterOperator)),
      { field: newFilterField, operator: newFilterOperator, value: newFilterValue },
    ]
    setConditions(nextConditions)
    setOffset(0)
    setAddFilterOpen(false)
    updateUrl(searchInput, logic, nextConditions, 0, sortBy, sortDir)
  }

  // Condition Builder Handlers (Level 3)
  const handleAddCondition = () => {
    const defaultField: InvestigationField = 'division'
    const defaultOp: InvestigationOperator = 'eq'
    const defaultVal = capabilities?.fields.find((f) => f.field === 'division')?.choices?.[0] || 'A'

    const nextConditions = [...conditions, { field: defaultField, operator: defaultOp, value: defaultVal }]
    setConditions(nextConditions)
    setOffset(0)
    updateUrl(searchInput, logic, nextConditions, 0, sortBy, sortDir)
  }

  const handleUpdateCondition = (index: number, patch: Partial<InvestigationCondition>) => {
    const nextConditions = [...conditions]
    const updated = { ...nextConditions[index], ...patch }

    if (patch.field && patch.field !== nextConditions[index].field) {
      const fieldCap = capabilities?.fields.find((f) => f.field === patch.field)
      if (fieldCap) {
        updated.operator = fieldCap.supported_operators[0] || 'eq'
        if (fieldCap.data_type === 'choice' && fieldCap.choices?.length) {
          updated.value = fieldCap.choices[0]
        } else if ((patch.field === 'course_code' || patch.field === 'absent_course_code') && courses.length > 0) {
          updated.value = courses[0].code
        } else if (fieldCap.data_type === 'number') {
          updated.value = fieldCap.min_value ?? 0
        } else if (fieldCap.data_type === 'boolean') {
          updated.value = true
        } else {
          updated.value = ''
        }
      }
    }

    nextConditions[index] = updated
    setConditions(nextConditions)
    setOffset(0)
    updateUrl(searchInput, logic, nextConditions, 0, sortBy, sortDir)
  }

  const handleRemoveCondition = (index: number) => {
    const nextConditions = conditions.filter((_, i) => i !== index)
    setConditions(nextConditions)
    setOffset(0)
    updateUrl(searchInput, logic, nextConditions, 0, sortBy, sortDir)
  }

  const handleClearAll = () => {
    setSearchInput('')
    setConditions([])
    setLogic('AND')
    setOffset(0)
    setSearchParams(new URLSearchParams())
  }

  const handleLogicToggle = (newLogic: InvestigationLogic) => {
    setLogic(newLogic)
    setOffset(0)
    updateUrl(searchInput, newLogic, conditions, 0, sortBy, sortDir)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    updateUrl(searchInput, logic, conditions, 0, sortBy, sortDir)
  }

  // Quick preset filter buttons
  const applyQuickPreset = (field: InvestigationField, operator: InvestigationOperator, value: any) => {
    const exists = conditions.some((c) => c.field === field && c.operator === operator && c.value === value)
    let next: InvestigationCondition[]
    if (exists) {
      next = conditions.filter((c) => !(c.field === field && c.operator === operator && c.value === value))
    } else {
      next = [...conditions.filter((c) => c.field !== field), { field, operator, value }]
    }
    setConditions(next)
    setOffset(0)
    updateUrl(searchInput, logic, next, 0, sortBy, sortDir)
  }

  // Sorting handler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      const nextDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(nextDir)
      updateUrl(searchInput, logic, conditions, offset, column, nextDir)
    } else {
      setSortBy(column)
      setSortDir('asc')
      updateUrl(searchInput, logic, conditions, offset, column, 'asc')
    }
  }

  // Excel Export action (.xlsx)
  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const blob = await downloadInvestigationExcel({
        group:
          conditions.length > 0
            ? {
                logic,
                conditions: conditions.filter((c) => c.value !== '' && c.value !== null && c.value !== undefined),
              }
            : null,
        search: searchInput.trim() || null,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
      saveBlobAsFile(blob, 'EduQuery_Academic_Investigation.xlsx')
    } catch {
      alert('Failed to generate Excel export. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const total = data?.total ?? 0
  const cohortTotal = data?.cohort_total ?? 0
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1
  const hasActiveFilters = Boolean(searchInput.trim() || conditions.length > 0)

  // Map field metadata for dropdowns
  const availableFields = capabilities?.fields ?? [
    { field: 'division', label: 'Division', data_type: 'choice', supported_operators: ['eq', 'neq'] },
    { field: 'result', label: 'Outcome', data_type: 'choice', supported_operators: ['eq', 'neq'] },
    { field: 'course_code', label: 'Subject', data_type: 'choice', supported_operators: ['eq', 'neq'] },
    { field: 'multi_fails', label: 'Failing 2+ Subjects', data_type: 'boolean', supported_operators: ['eq'] },
    { field: 'has_absent', label: 'Has Absent Marks', data_type: 'boolean', supported_operators: ['eq'] },
    { field: 'absent_subject_count', label: 'Absent Subject Count', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
    { field: 'absent_course_code', label: 'Absent in Subject', data_type: 'choice', supported_operators: ['eq', 'neq', 'in'] },
    { field: 'absent_component', label: 'Absent in Component', data_type: 'choice', supported_operators: ['eq', 'neq', 'in'] },
    { field: 'failed_subject_count', label: 'Failed Subject Count', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
    { field: 'total_marks', label: 'Total Marks', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
    { field: 'sgpi', label: 'SGPI', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
  ]

  const selectedFieldCap = availableFields.find((f) => f.field === newFilterField)

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Header & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Interactive Academic Investigation Engine
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Build multi-condition queries across student performance, failure patterns, and score thresholds
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Level 2 Toggle: Add Filter */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenAddFilter}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>Add Filter</span>
          </button>

          {/* Level 3 Toggle: Filter Builder */}
          <button
            type="button"
            className={`btn btn-sm ${builderOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBuilderOpen(!builderOpen)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Filter size={14} />
            <span>{builderOpen ? 'Hide Builder' : 'Filter Builder'}</span>
            {conditions.length > 0 && (
              <span
                style={{
                  backgroundColor: builderOpen ? 'rgba(255,255,255,0.25)' : 'var(--primary)',
                  color: '#ffffff',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                }}
              >
                {conditions.length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAll}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <RotateCcw size={13} /> Clear
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Level 2: Compact Add Filter Condition Editor Popover / Card */}
      {addFilterOpen && (
        <div
          className="card"
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <SlidersHorizontal size={16} style={{ color: 'var(--text)' }} />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Add Investigation Filter Condition</strong>
            </div>
            <button
              type="button"
              onClick={() => setAddFilterOpen(false)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.4rem', height: '26px' }}
              title="Close editor"
            >
              <X size={13} />
            </button>
          </div>

          <form onSubmit={handleApplySingleFilter} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* Field */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Field
              </label>
              <Listbox
                options={availableFields.map((f) => ({ value: f.field, label: f.label }))}
                value={newFilterField}
                onChange={(val) => handleFieldChangeForNewFilter(val as InvestigationField)}
                size="sm"
                ariaLabel="Filter field selector"
              />
            </div>

            {/* Operator */}
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Operator
              </label>
              <Listbox
                options={(selectedFieldCap?.supported_operators ?? ['eq', 'neq']).map((op) => ({
                  value: op,
                  label: OPERATOR_LABELS[op] || op,
                }))}
                value={newFilterOperator}
                onChange={(val) => setNewFilterOperator(val as InvestigationOperator)}
                size="sm"
                ariaLabel="Filter operator selector"
              />
            </div>

            {/* Value */}
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Target Value
              </label>
              {selectedFieldCap?.data_type === 'choice' ? (
                <Listbox
                  options={
                    newFilterField === 'course_code' || newFilterField === 'absent_course_code'
                      ? courses.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))
                      : (selectedFieldCap?.choices ?? []).map((ch) => ({ value: ch, label: ch }))
                  }
                  value={newFilterValue}
                  onChange={(val) => setNewFilterValue(val)}
                  size="sm"
                  ariaLabel="Filter target value"
                />
              ) : selectedFieldCap?.data_type === 'boolean' ? (
                <Listbox
                  options={[
                    { value: 'true', label: 'True (Yes)' },
                    { value: 'false', label: 'False (No)' },
                  ]}
                  value={String(newFilterValue)}
                  onChange={(val) => setNewFilterValue(val === 'true')}
                  size="sm"
                  ariaLabel="Filter boolean value"
                />
              ) : selectedFieldCap?.data_type === 'number' ? (
                <input
                  type="number"
                  className="input"
                  value={newFilterValue}
                  onChange={(e) => setNewFilterValue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                />
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="Value..."
                  value={newFilterValue}
                  onChange={(e) => setNewFilterValue(e.target.value)}
                  style={{ width: '100%', height: '34px', fontSize: '0.8rem' }}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" style={{ height: '34px', padding: '0 0.85rem' }}>
                <Check size={14} style={{ marginRight: '0.25rem' }} /> Apply Filter
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAddFilterOpen(false)}
                style={{ height: '34px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Level 1: Immediate Exploration Strip (Search + Quick Presets) */}
      <div className="card" style={{ padding: '0.85rem 1.15rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search by student identifier, name, roll no, seat no..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', height: '36px' }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ height: '36px', padding: '0 1rem' }}>
            Search
          </button>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Presets:</span>
            <button
              type="button"
              onClick={handleClearAll}
              className={`badge ${!hasActiveFilters ? 'badge-info' : 'badge-neutral'}`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              All Students
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('has_absent', 'eq', true)}
              className={`badge ${
                conditions.some((c) => c.field === 'has_absent' && c.value === true) ? 'badge-warning' : 'badge-neutral'
              }`}
              style={{
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                                                              }}
            >
              Students with Absences
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('multi_fails', 'eq', true)}
              className={`badge ${
                conditions.some((c) => c.field === 'multi_fails' && c.value === true) ? 'badge-danger' : 'badge-neutral'
              }`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              Failing 2+ Subjects
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('result', 'eq', 'FAILS')}
              className={`badge ${
                conditions.some((c) => c.field === 'result' && c.value === 'FAILS') ? 'badge-danger' : 'badge-neutral'
              }`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              All Failures
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('result', 'eq', 'PASSES')}
              className={`badge ${
                conditions.some((c) => c.field === 'result' && c.value === 'PASSES') ? 'badge-success' : 'badge-neutral'
              }`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              Passed Students
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('division', 'eq', 'A')}
              className={`badge ${
                conditions.some((c) => c.field === 'division' && c.value === 'A') ? 'badge-info' : 'badge-neutral'
              }`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              Division A
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('division', 'eq', 'B')}
              className={`badge ${
                conditions.some((c) => c.field === 'division' && c.value === 'B') ? 'badge-info' : 'badge-neutral'
              }`}
              style={{ cursor: 'pointer', padding: '0.25rem 0.5rem' }}
            >
              Division B
            </button>
          </div>
        </form>
      </div>

      {/* Level 3: Reusable Multi-Condition Investigation Builder (Expandable) */}
      {builderOpen && (
        <div className="card" style={{ padding: '1rem 1.25rem', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Investigation Query Builder
              </span>
              <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => handleLogicToggle('AND')}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    backgroundColor: logic === 'AND' ? 'var(--primary)' : '#ffffff',
                    color: logic === 'AND' ? '#ffffff' : 'var(--text-main)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Match ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => handleLogicToggle('OR')}
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    backgroundColor: logic === 'OR' ? 'var(--primary)' : '#ffffff',
                    color: logic === 'OR' ? '#ffffff' : 'var(--text-main)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Match ANY (OR)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddCondition}
              className="btn btn-secondary btn-sm"
              disabled={conditions.length >= 10}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
            >
              <Plus size={13} /> Add Condition
            </button>
          </div>

          {/* Condition Rows */}
          {conditions.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              No custom conditions defined. Click <strong>+ Add Condition</strong> above to construct multi-field filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conditions.map((cond, idx) => {
                const fieldCap = availableFields.find((f) => f.field === cond.field)
                const isChoice = fieldCap?.data_type === 'choice'
                const isNumber = fieldCap?.data_type === 'number'
                const isBoolean = fieldCap?.data_type === 'boolean'

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      backgroundColor: '#ffffff',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: '24px' }}>
                      #{idx + 1}
                    </span>

                    {/* Field Select */}
                    <div style={{ flex: '1.2 1 150px' }}>
                      <Listbox
                        options={availableFields.map((f) => ({ value: f.field, label: f.label }))}
                        value={cond.field}
                        onChange={(val) => handleUpdateCondition(idx, { field: val as InvestigationField })}
                        size="sm"
                        ariaLabel="Condition field selector"
                      />
                    </div>

                    {/* Operator Select */}
                    <div style={{ flex: '1 1 120px' }}>
                      <Listbox
                        options={(fieldCap?.supported_operators ?? ['eq', 'neq']).map((op) => ({
                          value: op,
                          label: OPERATOR_LABELS[op] || op,
                        }))}
                        value={cond.operator}
                        onChange={(val) => handleUpdateCondition(idx, { operator: val as InvestigationOperator })}
                        size="sm"
                        ariaLabel="Condition operator selector"
                      />
                    </div>

                    {/* Value Input */}
                    <div style={{ flex: '2 1 180px' }}>
                      {isChoice ? (
                        <Listbox
                          options={
                            cond.field === 'course_code' || cond.field === 'absent_course_code'
                              ? courses.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))
                              : (fieldCap?.choices ?? []).map((ch) => ({ value: ch, label: ch }))
                          }
                          value={cond.value}
                          onChange={(val) => handleUpdateCondition(idx, { value: val })}
                          size="sm"
                          ariaLabel="Condition target value"
                        />
                      ) : isBoolean ? (
                        <Listbox
                          options={[
                            { value: 'true', label: 'True (Yes)' },
                            { value: 'false', label: 'False (No)' },
                          ]}
                          value={String(cond.value)}
                          onChange={(val) => handleUpdateCondition(idx, { value: val === 'true' })}
                          size="sm"
                          ariaLabel="Condition boolean value"
                        />
                      ) : isNumber ? (
                        <input
                          type="number"
                          className="input"
                          value={cond.value}
                          onChange={(e) => handleUpdateCondition(idx, { value: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', height: '32px', fontSize: '0.8rem' }}
                        />
                      ) : (
                        <input
                          type="text"
                          className="input"
                          placeholder="Value..."
                          value={cond.value}
                          onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                          style={{ width: '100%', height: '32px', fontSize: '0.8rem' }}
                        />
                      )}
                    </div>

                    {/* Remove Condition Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.2rem 0.4rem', height: '32px' }}
                      title="Remove condition"
                    >
                      <X size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Active Conditions Chips & Human-Readable Explanation Banner */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {conditions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Active Filters:</span>
            {conditions.map((c, i) => {
              const fLabel = availableFields.find((f) => f.field === c.field)?.label || c.field
              const opLabel = OPERATOR_LABELS[c.operator] || c.operator
              return (
                <span
                  key={i}
                  data-testid="active-filter-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--surface-hover)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  <span>
                    {fLabel} {opLabel} {String(c.value)}
                  </span>
                  <span
                    onClick={() => handleRemoveCondition(i)}
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    title="Remove filter"
                  >
                    <X size={12} style={{ color: 'var(--text-muted)' }} />
                  </span>
                </span>
              )
            })}
          </div>
        )}

        {/* Live Matching Count & Rule Explanation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.45rem 0.75rem',
            backgroundColor: 'var(--surface-hover)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: '0.8rem',
            color: 'var(--text)',
          }}
        >
          <div>
            Showing <strong>{total}</strong> of <strong>{cohortTotal}</strong> matching cohort students{' '}
            {cohortTotal > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                ({((total / cohortTotal) * 100).toFixed(1)}% of total cohort)
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {data?.active_explanation || 'All cohort students'}
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} title="Query Error" onRetry={fetchInvestigationResults} />}

      {/* 5. Interactive Data Table with Sorting and Supporting Record Links */}
      {loading ? (
        <LoadingState message="Executing parameterized academic query..." />
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('seat_no')}
                    style={{ width: '13%', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by Seat / Roll"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>Seat / Roll No</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'seat_no' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    style={{ width: '21%', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by Student Name"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>Student Name</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'name' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('division')}
                    style={{ width: '8%', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by Division"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>Division</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'division' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th style={{ width: '9%', textAlign: 'center' }} title="Distinct passed curriculum subjects">
                    <span>Passed</span>
                  </th>
                  <th style={{ width: '9%', textAlign: 'center' }} title="Distinct failed curriculum subjects">
                    <span>Failed</span>
                  </th>
                  <th style={{ width: '9%', textAlign: 'center' }} title="Distinct subjects with verified absent marks">
                    <span>Absent</span>
                  </th>
                  <th
                    onClick={() => handleSort('total_marks')}
                    style={{ width: '10%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by Total Marks"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                      <span>Total Marks</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'total_marks' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('sgpi')}
                    style={{ width: '8%', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by SGPI"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                      <span>SGPI</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'sgpi' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('result')}
                    style={{ width: '11%', cursor: 'pointer', userSelect: 'none' }}
                    title="Sort by Academic Outcome"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>Outcome</span>
                      <ArrowUpDown size={12} style={{ color: sortBy === 'result' ? 'var(--primary)' : 'var(--text-muted)' }} />
                    </div>
                  </th>
                  <th style={{ width: '7%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((st) => {
                    const resUpper = (st.overall_result || '').toUpperCase()
                    const statusType = resUpper.includes('PASS')
                      ? 'passed'
                      : resUpper.includes('FAIL')
                      ? 'failed'
                      : 'unresolved'

                    return (
                      <tr key={st.student_id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                          <div>{st.roll_no || st.seat_no || st.student_id}</div>
                          {st.roll_no && st.seat_no && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Seat: {st.seat_no}
                            </div>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/students/${encodeURIComponent(st.student_id)}`}
                            style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'none' }}
                            className="hover-underline"
                          >
                            {st.name}
                          </Link>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {st.student_id}
                          </div>
                        </td>
                        <td>
                          {st.division ? (
                            <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                              Div {st.division}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: '24px', display: 'inline-block' }}
                            title={`${st.passed_subject_count ?? 0} distinct passed subjects`}
                          >
                            {st.passed_subject_count ?? 0}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${(st.failed_subject_count ?? 0) > 0 ? 'badge-danger' : 'badge-neutral'}`}
                            style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: '24px', display: 'inline-block' }}
                            title={`${st.failed_subject_count ?? 0} distinct failed subjects`}
                          >
                            {st.failed_subject_count ?? 0}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              minWidth: '24px',
                              display: 'inline-block',
                              backgroundColor: (st.absent_subject_count ?? 0) > 0 ? 'var(--status-warning-fill)' : 'var(--surface-hover)',
                              color: (st.absent_subject_count ?? 0) > 0 ? 'var(--status-warning-text)' : 'var(--text-muted)',
                              border: (st.absent_subject_count ?? 0) > 0 ? '1px solid var(--status-warning-border)' : '1px solid var(--border)',
                            }}
                            title={`${st.absent_subject_count ?? 0} distinct subjects with absent marks`}
                          >
                            {st.absent_subject_count ?? 0}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {st.total_marks !== null ? st.total_marks.toLocaleString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {st.sgpi !== null ? st.sgpi.toFixed(2) : '—'}
                        </td>
                        <td>
                          <StatusBadge status={statusType} text={st.overall_result || 'UNRESOLVED'} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            to={`/students/${encodeURIComponent(st.student_id)}`}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.74rem',
                            }}
                          >
                            <span>Inspect</span>
                            <ArrowRight size={11} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        No records match the active investigation conditions
                      </div>
                      <div style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
                        Try broadening numeric ranges, changing logic from AND to OR, or clearing specific condition tags.
                      </div>
                      {hasActiveFilters && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearAll}>
                          Reset All Conditions
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.82rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ color: 'var(--text-muted)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({total} records)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={offset === 0}
                  onClick={() => {
                    const newOffset = Math.max(0, offset - limit)
                    setOffset(newOffset)
                    updateUrl(searchInput, logic, conditions, newOffset, sortBy, sortDir)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={offset + limit >= total}
                  onClick={() => {
                    const newOffset = offset + limit
                    setOffset(newOffset)
                    updateUrl(searchInput, logic, conditions, newOffset, sortBy, sortDir)
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
