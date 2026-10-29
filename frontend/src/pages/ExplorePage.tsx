import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Compass,
  Download,
  X,
  ArrowUpRight,
  Plus,
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
  askAi,
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
  StudentSummaryItem,
  AskAiResponse,
} from '../api/types'
import { Sparkles, AlertCircle } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { Button } from '../ui/Button'
import { SearchField } from '../ui/SearchField'
import { Listbox } from '../ui/Listbox'
import { DataTable, type Column } from '../ui/DataTable'
import { StatusBadge } from '../ui/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../ui/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { toTitleCase } from '../utils/text'

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
  const [aiResponse, setAiResponse] = useState<AskAiResponse | null>(null)
  const [aiLoading, setAiLoading] = useState<boolean>(false)

  const aiQuery = searchParams.get('ai_query') || (searchParams.get('source') === 'ai' ? searchParams.get('search') : null)

  useEffect(() => {
    if (aiQuery && aiQuery.trim()) {
      setAiLoading(true)
      askAi({ query: aiQuery.trim() })
        .then((res) => {
          setAiResponse(res)
          if (!res.is_refused && res.predicate_ast?.conditions && res.predicate_ast.conditions.length > 0) {
            setConditions(res.predicate_ast.conditions)
            if (res.query_request?.sort_by) {
              setSortBy(res.query_request.sort_by as any)
            }
            if (res.query_request?.sort_dir) {
              setSortDir(res.query_request.sort_dir)
            }
          }
        })
        .catch(() => {})
        .finally(() => setAiLoading(false))
    }
  }, [aiQuery])

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

  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      const nextDir = sortDir === 'asc' ? 'desc' : 'asc'
      setSortDir(nextDir)
      updateUrl(searchInput, logic, conditions, offset, colKey, nextDir)
    } else {
      setSortBy(colKey)
      setSortDir('asc')
      updateUrl(searchInput, logic, conditions, offset, colKey, 'asc')
    }
  }
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

  // 2. Parse initial URL searchParams into state conditions
  useEffect(() => {
    const nextConditions: InvestigationCondition[] = []

    const div = searchParams.get('division')
    if (div) nextConditions.push({ field: 'division', operator: 'eq', value: div })

    const res = searchParams.get('result')
    if (res) nextConditions.push({ field: 'result', operator: 'eq', value: res.toUpperCase() })

    const course = searchParams.get('course')
    if (course) nextConditions.push({ field: 'course_code', operator: 'eq', value: course })

    const multiFails = searchParams.get('multi_fails')
    if (multiFails === 'true') nextConditions.push({ field: 'multi_fails', operator: 'eq', value: true })

    const hasAbsent = searchParams.get('has_absent')
    if (hasAbsent === 'true') nextConditions.push({ field: 'has_absent', operator: 'eq', value: true })

    const minAbsent = searchParams.get('min_absent')
    if (minAbsent) {
      const parsed = parseInt(minAbsent, 10)
      if (!isNaN(parsed)) {
        nextConditions.push({ field: 'absent_subject_count', operator: 'gte', value: parsed })
      }
    }

    if (nextConditions.length > 0) {
      setConditions(nextConditions)
    }
  }, [searchParams])

  // 3. Execution of investigation query against backend API
  const fetchInvestigationResults = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const requestPayload: InvestigationQueryRequest = {
      search: searchInput.trim() || undefined,
      group: {
        logic,
        conditions,
      },
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
    const next = [{ field, operator, value }]
    setConditions(next)
    setOffset(0)
    updateUrl(searchInput, logic, next, 0, sortBy, sortDir)
  }

  // Export
  const handleExportExcel = async () => {
    if (exporting || !data || data.total === 0) return
    setExporting(true)
    try {
      const payload: InvestigationQueryRequest = {
        search: searchInput.trim() || undefined,
        group: { logic, conditions },
        sort_by: sortBy,
        sort_dir: sortDir,
      }
      const blob = await downloadInvestigationExcel(payload)
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      saveBlobAsFile(blob, `EduQuery_Investigation_Export_${timestamp}.xlsx`)
    } catch (err) {
      console.error('Failed to export investigation query to Excel:', err)
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters = conditions.length > 0 || Boolean(searchInput.trim())
  const total = data?.total ?? 0
  const cohortTotal = data?.cohort_total ?? 145

  // List of capabilities fields
  const availableFields = capabilities?.fields ?? [
    { field: 'division', label: 'Division', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: ['A', 'B'] },
    { field: 'result', label: 'Outcome', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: ['PASSES', 'FAILS'] },
    { field: 'course_code', label: 'Subject', data_type: 'choice', supported_operators: ['eq', 'neq'], choices: [] },
    { field: 'multi_fails', label: 'Failing 2+ Subjects', data_type: 'boolean', supported_operators: ['eq'] },
    { field: 'has_absent', label: 'Has Any Absence', data_type: 'boolean', supported_operators: ['eq'] },
    { field: 'absent_course_code', label: 'Absent in Subject', data_type: 'choice', supported_operators: ['eq', 'neq'] },
    { field: 'absent_component', label: 'Absent in Component', data_type: 'choice', supported_operators: ['eq', 'neq', 'in'] },
    { field: 'failed_subject_count', label: 'Failed Subject Count', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
    { field: 'total_marks', label: 'Total Marks', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
    { field: 'sgpi', label: 'SGPI', data_type: 'number', supported_operators: ['gte', 'lte', 'eq'] },
  ]

  const selectedFieldCap = availableFields.find((f) => f.field === newFilterField)

  const columns: Column<StudentSummaryItem>[] = [
    {
      key: 'seat_no',
      header: 'Seat / Roll',
      width: '95px',
      sticky: true,
      sortable: true,
      render: (st) => (
        <div className="font-mono">
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>
            {st.seat_no || st.roll_no || st.student_id}
          </div>
          {st.roll_no && st.seat_no && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Roll: {st.roll_no}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      minWidth: '140px',
      maxWidth: '220px',
      wrap: true,
      sortable: true,
      render: (st) => (
        <div>
          <Link
            to={`/students/${encodeURIComponent(st.student_id)}`}
            style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none', lineHeight: 1.3 }}
            className="hover-underline"
          >
            {toTitleCase(st.name)}
          </Link>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {st.student_id}
          </div>
        </div>
      ),
    },
    {
      key: 'division',
      header: 'Div',
      width: '50px',
      align: 'center',
      sortable: true,
      render: (st) => (
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
          }}
        >
          {st.division ? `Div ${st.division}` : '—'}
        </span>
      ),
    },
    {
      key: 'passed_count',
      header: 'Passed',
      width: '60px',
      align: 'right',
      render: (st) => (
        <span className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--text)' }}>
          {st.passed_subject_count ?? 0}
        </span>
      ),
    },
    {
      key: 'failed_count',
      header: 'Failed',
      width: '60px',
      align: 'right',
      render: (st) => {
        const fails = st.failed_subject_count ?? 0
        return (
          <span
            className="font-mono tabular-nums"
            style={{
              fontWeight: 600,
              color: fails > 0 ? 'var(--status-danger-text)' : 'var(--text-muted)',
            }}
          >
            {fails}
          </span>
        )
      },
    },
    {
      key: 'absent_count',
      header: 'Absent',
      width: '60px',
      align: 'right',
      render: (st) => {
        const abs = st.absent_subject_count ?? 0
        return (
          <span
            className="font-mono tabular-nums"
            style={{
              fontWeight: 600,
              color: abs > 0 ? 'var(--status-warning-text)' : 'var(--text-muted)',
            }}
          >
            {abs}
          </span>
        )
      },
    },
    {
      key: 'total_marks',
      header: 'Total',
      width: '70px',
      sortable: true,
      align: 'right',
      render: (st) => (
        <span className="font-mono tabular-nums">
          {st.total_marks !== null && st.total_marks !== undefined ? st.total_marks : '—'}
        </span>
      ),
    },
    {
      key: 'sgpi',
      header: 'SGPI',
      width: '65px',
      sortable: true,
      align: 'right',
      render: (st) => (
        <span className="font-mono tabular-nums" style={{ fontWeight: 600 }}>
          {st.sgpi !== null && st.sgpi !== undefined ? Number(st.sgpi).toFixed(2) : '—'}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      width: '85px',
      sortable: true,
      align: 'center',
      render: (st) => {
        const resUpper = (st.overall_result || '').toUpperCase()
        const tone: 'pass' | 'fail' | 'warn' = resUpper.includes('PASS')
          ? 'pass'
          : resUpper.includes('FAIL')
          ? 'fail'
          : 'warn'
        return <StatusBadge tone={tone} size="sm" label={resUpper || 'Pending'} />
      },
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right',
      render: (st) => (
        <Link
          to={`/students/${encodeURIComponent(st.student_id)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            transition: 'all var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
        >
          <span>View</span>
          <ArrowUpRight size={12} />
        </Link>
      ),
    },
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
      {/* 1. Header & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
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
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-1)',
            }}
          >
            <Compass size={14} />
            <span>ACADEMIC INVESTIGATION ENGINE</span>
          </div>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Interactive Academic Investigation Engine
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              margin: 'var(--space-1) 0 0 0',
            }}
          >
            Build multi-condition queries across student performance, failure patterns, and score thresholds
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddFilter}
            icon={<Plus size={14} />}
          >
            Add Filter
          </Button>

          <Button
            variant={builderOpen ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setBuilderOpen(!builderOpen)}
            icon={<SlidersHorizontal size={14} />}
          >
            <span>{builderOpen ? 'Hide Builder' : 'Filter Builder'}</span>
            {conditions.length > 0 && (
              <span
                style={{
                  marginLeft: '4px',
                  background: 'var(--surface-active)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {conditions.length}
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              icon={<RotateCcw size={13} />}
            >
              Clear
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            loading={exporting}
            icon={<Download size={14} />}
          >
            Export to Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Ask AI Interpreted Query Banner (Requirement 7 & 11.1) */}
      {(searchParams.get('source') === 'ai' || searchParams.get('from_ai') === 'true' || Boolean(aiQuery)) && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: aiResponse?.is_refused ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-hover)',
            border: `1px solid ${aiResponse?.is_refused ? 'var(--status-danger)' : 'var(--border-strong)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {aiResponse?.is_refused ? (
                <AlertCircle size={16} style={{ color: 'var(--status-danger)', flexShrink: 0 }} />
              ) : (
                <Sparkles size={16} style={{ color: 'var(--text)', flexShrink: 0 }} />
              )}
              <span>
                <strong style={{ color: 'var(--text)' }}>
                  {aiResponse?.is_refused ? 'Prohibited Analysis Refused' : 'Interpreted from Ask AI query:'}
                </strong>{' '}
                {aiQuery ? `"${aiQuery}"` : 'Natural language query translated into predicate AST'}
              </span>
            </div>
            <Link
              to="/explore"
              onClick={() => {
                setAiResponse(null)
                handleClearAll()
              }}
              style={{ fontSize: '11px', color: 'var(--text-secondary)', textDecoration: 'underline' }}
            >
              Reset Query
            </Link>
          </div>

          {aiLoading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Translating natural language into schema-only predicate AST...
            </div>
          )}

          {aiResponse?.is_refused ? (
            <div style={{ color: 'var(--status-danger)', fontSize: '12px', fontWeight: 500 }}>
              {aiResponse.refusal}
            </div>
          ) : aiResponse?.explanation ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
              {aiResponse.explanation}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Natural language translated into predicate filter conditions. Click any chip below to edit or remove.
            </div>
          )}
        </div>
      )}

      {/* Level 2: Compact Add Filter Condition Editor Popover / Card */}
      {addFilterOpen && (
        <GlassCard elevation={2} padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} style={{ color: 'var(--text)' }} />
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
                Add Investigation Filter Condition
              </strong>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddFilterOpen(false)}
              title="Close editor"
            >
              <X size={14} />
            </Button>
          </div>

          <form onSubmit={handleApplySingleFilter} style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* Field */}
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
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
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
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

            {/* Target Value */}
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Value
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
                  ariaLabel="Filter target value selector"
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
                  ariaLabel="Filter boolean value selector"
                />
              ) : selectedFieldCap?.data_type === 'number' ? (
                <input
                  type="number"
                  className="input"
                  value={newFilterValue}
                  onChange={(e) => setNewFilterValue(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', height: '36px', padding: '0 12px', borderRadius: 'var(--radius-input)', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 'var(--text-sm)' }}
                />
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder="Target value..."
                  value={newFilterValue}
                  onChange={(e) => setNewFilterValue(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 12px', borderRadius: 'var(--radius-input)', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 'var(--text-sm)' }}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button type="submit" variant="primary" size="sm" icon={<Check size={14} />}>
                Apply Filter
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddFilterOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Level 3: Reusable Multi-Condition Investigation Builder (Expandable) */}
      {builderOpen && (
        <GlassCard elevation={2} padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text)' }}>
                Investigation Query Builder
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 'var(--radius-input)',
                  padding: '2px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleLogicToggle('AND')}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: logic === 'AND' ? 'var(--action-primary-bg)' : 'transparent',
                    color: logic === 'AND' ? 'var(--action-primary-text)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Match ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => handleLogicToggle('OR')}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: logic === 'OR' ? 'var(--action-primary-bg)' : 'transparent',
                    color: logic === 'OR' ? 'var(--action-primary-text)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Match ANY (OR)
                </button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddCondition}
              disabled={conditions.length >= 10}
              icon={<Plus size={13} />}
            >
              Add Condition
            </Button>
          </div>

          {/* Condition Rows */}
          {conditions.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-card)' }}>
              No custom conditions defined. Click <strong>+ Add Condition</strong> above to construct multi-field filters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      gap: '8px',
                      flexWrap: 'wrap',
                      backgroundColor: 'var(--surface-hover)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', width: '24px' }}>
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
                          style={{ width: '100%', height: '32px', fontSize: 'var(--text-xs)', padding: '0 8px', borderRadius: 'var(--radius-input)', background: 'var(--surface-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        />
                      ) : (
                        <input
                          type="text"
                          className="input"
                          placeholder="Value..."
                          value={cond.value}
                          onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                          style={{ width: '100%', height: '32px', fontSize: 'var(--text-xs)', padding: '0 8px', borderRadius: 'var(--radius-input)', background: 'var(--surface-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        />
                      )}
                    </div>

                    {/* Remove Condition Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCondition(idx)}
                      title="Remove condition"
                    >
                      <X size={14} style={{ color: 'var(--status-danger-text)' }} />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* Immediate Exploration Strip (Search + Quick Presets) */}
      <GlassCard elevation={1} padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 'var(--space-3)', width: '100%', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SearchField
                placeholder="Search by student identifier, name, roll no, seat no..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search cohort students"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Presets:
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: !hasActiveFilters ? 600 : 500,
                background: !hasActiveFilters ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: !hasActiveFilters ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${!hasActiveFilters ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              All Students
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('has_absent', 'eq', true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'has_absent' && c.value === true) ? 600 : 500,
                background: conditions.some((c) => c.field === 'has_absent' && c.value === true) ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'has_absent' && c.value === true) ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'has_absent' && c.value === true) ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Students with Absences
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('multi_fails', 'eq', true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'multi_fails' && c.value === true) ? 600 : 500,
                background: conditions.some((c) => c.field === 'multi_fails' && c.value === true) ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'multi_fails' && c.value === true) ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'multi_fails' && c.value === true) ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Failing 2+ Subjects
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('result', 'eq', 'FAILS')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'result' && c.value === 'FAILS') ? 600 : 500,
                background: conditions.some((c) => c.field === 'result' && c.value === 'FAILS') ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'result' && c.value === 'FAILS') ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'result' && c.value === 'FAILS') ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              All Failures
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('result', 'eq', 'PASSES')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'result' && c.value === 'PASSES') ? 600 : 500,
                background: conditions.some((c) => c.field === 'result' && c.value === 'PASSES') ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'result' && c.value === 'PASSES') ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'result' && c.value === 'PASSES') ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Passed Students
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('division', 'eq', 'A')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'division' && c.value === 'A') ? 600 : 500,
                background: conditions.some((c) => c.field === 'division' && c.value === 'A') ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'division' && c.value === 'A') ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'division' && c.value === 'A') ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Division A
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset('division', 'eq', 'B')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                fontWeight: conditions.some((c) => c.field === 'division' && c.value === 'B') ? 600 : 500,
                background: conditions.some((c) => c.field === 'division' && c.value === 'B') ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                color: conditions.some((c) => c.field === 'division' && c.value === 'B') ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                border: `1px solid ${conditions.some((c) => c.field === 'division' && c.value === 'B') ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Division B
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Active Conditions Chips & Human-Readable Explanation Banner */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {conditions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Filters:</span>
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
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--text-xs)',
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
            gap: '8px',
            padding: '8px 14px',
            background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text)',
          }}
        >
          <div>
            Showing <strong>{total}</strong> of <strong>{cohortTotal}</strong> matching cohort students{' '}
            {cohortTotal > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                ({((total / cohortTotal) * 100).toFixed(1)}% of total cohort)
              </span>
            )}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {data?.active_explanation || 'All cohort students'}
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} title="Query Error" onRetry={fetchInvestigationResults} />}

      {/* Main Table / Empty / Loading */}
      {loading ? (
        <LoadingState message="Executing parameterized academic query..." />
      ) : total === 0 ? (
        <EmptyState
          title="No records match the active investigation conditions"
          description="Try adjusting your filters, clearing search criteria, or selecting a different preset."
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleClearAll}>
                Reset Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable<StudentSummaryItem>
          columns={columns}
          data={data?.items || []}
          keyExtractor={(st) => st.student_id}
          isLoading={loading}
          showDensityToggle={true}
          defaultDensity="comfortable"
          showPagination={true}
          initialSortKey={sortBy}
          initialSortDirection={sortDir}
          onSortChange={handleSort}
          serverTotal={total}
          currentPage={Math.floor(offset / limit) + 1}
          pageSize={limit}
          onPageChange={(newPage) => {
            const nextOffset = (newPage - 1) * limit
            setOffset(nextOffset)
            updateUrl(searchInput, logic, conditions, nextOffset, sortBy, sortDir)
          }}
        />
      )}
    </div>
  )
}

export default ExplorePage
