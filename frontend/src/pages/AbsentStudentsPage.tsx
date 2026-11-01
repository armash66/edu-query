import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  UserX,
  Mail,
  Download,
  Printer,
  AlertTriangle,
  BookOpen,
  Users,
  List,
  ArrowUpRight,
} from 'lucide-react'
import {
  getAbsentStudents,
  getAbsentComponents,
  getSubjects,
  downloadAbsentStudentsExcel,
} from '../api/client'
import { exportAbsentStudents } from '../utils/excelExport'
import {
  ApiError,
  type AbsentStudentItem,
  type AbsentStudentsParams,
  type CourseItem,
  type PaginatedResponse,
} from '../api/types'
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

export interface GroupedCourseAbsence {
  course_code: string
  course_name: string
  components: string[]
  raw_texts: string[]
}

export interface GroupedAbsentStudent {
  student_id: string
  roll_no: string | null
  seat_no: string | null
  name: string
  email: string
  division: string | null
  overall_result: string | null
  total_absences: number
  courses: GroupedCourseAbsence[]
  records: AbsentStudentItem[]
}

export const AbsentStudentsPage: React.FC = () => {
  const [records, setRecords] = useState<AbsentStudentItem[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [totalCourses, setTotalCourses] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  // View Mode: 'grouped' (aggregate by student) vs 'records' (individual evaluations)
  const [viewMode, setViewMode] = useState<'grouped' | 'records'>('grouped')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'isolated' | 'extended'>('all')

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')
  const [courseFilter, setCourseFilter] = useState<string>('')
  const [componentFilter, setComponentFilter] = useState<string>('')
  const [groupedPage, setGroupedPage] = useState<number>(1)
  const [recordsPage, setRecordsPage] = useState<number>(1)
  const pageSize = 25

  // Filter Dropdown options
  const [availableCourses, setAvailableCourses] = useState<CourseItem[]>([])
  const [availableComponents, setAvailableComponents] = useState<string[]>([])

  // Export & Print State
  const [exporting, setExporting] = useState<boolean>(false)
  const [printing, setPrinting] = useState<boolean>(false)
  const [printRecords, setPrintRecords] = useState<AbsentStudentItem[] | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch filter dropdown options once on mount
  useEffect(() => {
    let active = true
    Promise.allSettled([
      getSubjects({ limit: 100 }),
      getAbsentComponents(),
    ]).then(([subjectsRes, compRes]) => {
      if (!active) return
      if (subjectsRes.status === 'fulfilled') {
        setAvailableCourses(subjectsRes.value.items || [])
      }
      if (compRes.status === 'fulfilled') {
        setAvailableComponents(compRes.value || [])
      }
    })
    return () => {
      active = false
    }
  }, [])

  const fetchAbsentList = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    const params: AbsentStudentsParams = {
      query: searchQuery.trim() || undefined,
      division: divisionFilter.trim() || undefined,
      course_code: courseFilter.trim() || undefined,
      component: componentFilter.trim() || undefined,
      limit: 1000,
      offset: 0,
    }

    try {
      const data: PaginatedResponse<AbsentStudentItem> = await getAbsentStudents(params, controller.signal)
      setRecords(data.items || [])
      setTotal(data.total || (data.items || []).length)
      setTotalStudents(data.total_students ?? new Set((data.items || []).map((r) => r.student_id)).size)
      setTotalCourses(data.total_courses ?? new Set((data.items || []).map((r) => r.course_code)).size)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'CLIENT_ERROR', 'Failed to retrieve absent student records'))
      }
    } finally {
      setLoading(false)
    }
  }, [searchQuery, divisionFilter, courseFilter, componentFilter])

  useEffect(() => {
    fetchAbsentList()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchAbsentList])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setGroupedPage(1)
    setRecordsPage(1)
  }

  const handleDivisionChange = (val: string) => {
    setDivisionFilter(val)
    setGroupedPage(1)
    setRecordsPage(1)
  }

  const handleCourseChange = (val: string) => {
    setCourseFilter(val)
    setGroupedPage(1)
    setRecordsPage(1)
  }

  const handleComponentChange = (val: string) => {
    setComponentFilter(val)
    setGroupedPage(1)
    setRecordsPage(1)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setDivisionFilter('')
    setCourseFilter('')
    setComponentFilter('')
    setSeverityFilter('all')
    setGroupedPage(1)
    setRecordsPage(1)
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() || divisionFilter || courseFilter || componentFilter || severityFilter !== 'all'
  )

  const handleExportExcel = async () => {
    if (exporting || total === 0) return
    setExporting(true)
    try {
      const params: AbsentStudentsParams = {
        query: searchQuery.trim() || undefined,
        division: divisionFilter.trim() || undefined,
        course_code: courseFilter.trim() || undefined,
        component: componentFilter.trim() || undefined,
      }
      try {
        await downloadAbsentStudentsExcel(params)
      } catch (backendErr) {
        console.warn('Server-side absent xlsx export failed, falling back to client CSV export', backendErr)
        const fetchAll = await getAbsentStudents({ ...params, limit: 10000, offset: 0 })
        const dataset = fetchAll.items || []
        exportAbsentStudents(dataset, false)
      }
    } catch (err) {
      console.error('Failed to export absent student records to Excel:', err)
    } finally {
      setExporting(false)
    }
  }

  const handlePrintRoster = async () => {
    if (printing || total === 0) return
    setPrinting(true)
    try {
      const params: AbsentStudentsParams = {
        query: searchQuery.trim() || undefined,
        division: divisionFilter.trim() || undefined,
        course_code: courseFilter.trim() || undefined,
        component: componentFilter.trim() || undefined,
        limit: 10000,
        offset: 0,
      }
      const allRecords = await getAbsentStudents(params)
      setPrintRecords(allRecords.items || [])
      setTimeout(() => {
        window.print()
        setPrinting(false)
      }, 300)
    } catch (err) {
      console.error('Failed to load complete dataset for printing:', err)
      window.print()
      setPrinting(false)
    }
  }

  // Summary counts
  const distinctStudents = totalStudents || new Set(records.map((r) => r.student_id)).size
  const distinctCourses = totalCourses || new Set(records.map((r) => r.course_code)).size
  const recordsToPrint = printRecords && printRecords.length > 0 ? printRecords : records

  // Map of student_id -> total absences count across all loaded records
  const studentAbsenceCountMap = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach((r) => {
      counts[r.student_id] = (counts[r.student_id] || 0) + 1
    })
    return counts
  }, [records])

  // Group records by student
  const groupedStudentsAll = useMemo(() => {
    const map = new Map<string, GroupedAbsentStudent>()

    records.forEach((r) => {
      if (!map.has(r.student_id)) {
        map.set(r.student_id, {
          student_id: r.student_id,
          roll_no: r.roll_no,
          seat_no: r.seat_no,
          name: r.name,
          email: (r as any).email || `${r.roll_no || r.seat_no || r.student_id}@student.univ.edu`,
          division: r.division,
          overall_result: r.overall_result,
          total_absences: 0,
          courses: [],
          records: [],
        })
      }
      const student = map.get(r.student_id)!
      student.total_absences += 1
      student.records.push(r)

      let course = student.courses.find((c) => c.course_code === r.course_code)
      if (!course) {
        course = {
          course_code: r.course_code,
          course_name: r.course_name,
          components: [],
          raw_texts: [],
        }
        student.courses.push(course)
      }
      if (r.component && !course.components.includes(r.component)) {
        course.components.push(r.component)
      }
      if (r.raw_text && !course.raw_texts.includes(r.raw_text)) {
        course.raw_texts.push(r.raw_text)
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (b.total_absences !== a.total_absences) {
        return b.total_absences - a.total_absences
      }
      return a.name.localeCompare(b.name)
    })
  }, [records])

  // Partition candidates into severity tiers
  const isolatedCandidates = useMemo(
    () => groupedStudentsAll.filter((s) => s.courses.length <= 2),
    [groupedStudentsAll]
  )

  const extendedCandidates = useMemo(
    () => groupedStudentsAll.filter((s) => s.courses.length > 2),
    [groupedStudentsAll]
  )

  // Filtered grouped candidates based on severity filter
  const groupedStudents = useMemo(() => {
    if (severityFilter === 'isolated') return isolatedCandidates
    if (severityFilter === 'extended') return extendedCandidates
    return groupedStudentsAll
  }, [groupedStudentsAll, isolatedCandidates, extendedCandidates, severityFilter])

  // Paged slices for client-side pagination
  const pagedGrouped = useMemo(() => {
    const start = (groupedPage - 1) * pageSize
    return groupedStudents.slice(start, start + pageSize)
  }, [groupedStudents, groupedPage, pageSize])

  const pagedRecords = useMemo(() => {
    const start = (recordsPage - 1) * pageSize
    return records.slice(start, start + pageSize)
  }, [records, recordsPage, pageSize])

  // Columns for Grouped By Student view
  const groupedColumns: Column<GroupedAbsentStudent>[] = [
    {
      key: 'roll_no',
      header: 'Seat / Roll',
      width: '130px',
      sticky: true,
      render: (row) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
            {row.roll_no || row.seat_no || row.student_id}
          </span>
          {row.roll_no && row.seat_no && (
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Seat: {row.seat_no}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      minWidth: '160px',
      maxWidth: '240px',
      wrap: true,
      render: (row) => (
        <Link
          to={`/students/${encodeURIComponent(row.student_id)}`}
          style={{
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            display: 'inline-block',
            lineHeight: 1.3,
          }}
          className="hover-underline"
          title={row.name}
        >
          {toTitleCase(row.name)}
        </Link>
      ),
    },
    {
      key: 'division',
      header: 'Div',
      width: '50px',
      align: 'center',
      render: (row) => (
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
          {row.division || '—'}
        </span>
      ),
    },
    {
      key: 'total_absences',
      header: 'Total Absences',
      width: '140px',
      align: 'center',
      render: (row) => (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <StatusBadge
            tone={row.total_absences >= 3 ? 'fail' : 'warn'}
            size="sm"
            label={`${row.total_absences} Missed`}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            in {row.courses.length} subject{row.courses.length === 1 ? '' : 's'}
          </span>
        </div>
      ),
    },
    {
      key: 'courses',
      header: 'Missed Subjects & Components',
      minWidth: '280px',
      wrap: true,
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 0' }}>
          {row.courses.map((c) => (
            <span
              key={c.course_code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                fontSize: '11px',
                lineHeight: 1.3,
              }}
              title={c.course_name}
            >
              <Link
                to={`/subjects/${encodeURIComponent(c.course_code)}`}
                style={{
                  fontWeight: 700,
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
                className="hover-underline"
              >
                {c.course_code}
              </Link>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                ({c.components.join(', ')})
              </span>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'overall_result',
      header: 'Result',
      width: '100px',
      align: 'center',
      render: (row) => {
        const outcome = (row.overall_result || '').toUpperCase()
        const tone: 'pass' | 'fail' | 'warn' = outcome.includes('PASS')
          ? 'pass'
          : outcome.includes('FAIL')
          ? 'fail'
          : 'warn'
        return <StatusBadge tone={tone} size="sm" label={outcome || 'UNRESOLVED'} />
      },
    },
    {
      key: 'actions',
      header: '',
      width: '180px',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            title={`Email official absence notice for all ${row.total_absences} missed evaluations`}
            onClick={(e) => {
              e.preventDefault()
              const email = row.email || `${row.roll_no || row.student_id}@student.univ.edu`
              const subject = `Academic Notice: Missed Examination Documentation - ${toTitleCase(row.name)} (${row.seat_no || row.roll_no || row.student_id})`
              const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              const missedBreakdown = row.courses
                .map((c) => `• ${c.course_name} (${c.course_code}) — Component(s): ${c.components.join(', ')}`)
                .join('\n')
              const body = `ABSENTEE MAKE-UP EXAMINATION NOTIFICATION
Date: ${formattedDate}
To: ${toTitleCase(row.name)} (${row.seat_no || row.roll_no || row.student_id})
Division: ${row.division || '—'}
Email: ${email}
Subject: Official Documentation Submission for Missed Examination Components

Dear ${toTitleCase(row.name)},

University examination records indicate your absence across ${row.total_absences} examination evaluation(s):
${missedBreakdown}

Under university academic regulations, unexcused absence results in an unresolved grade penalty. If your absence was occasioned by verified medical emergencies, institutional duty, or unforeseen bereavement, you may petition for make-up re-evaluation eligibility.

Action Required:
• Submit your formal petition along with verified supporting medical or institutional certificates to the Examination Cell within five (5) business days.
• Completed documentation must be countersigned by your Department Head before make-up scheduling can proceed.
• Late or unsubstantiated submissions will not be entertained.

Student Details:
• Student Name: ${toTitleCase(row.name)}
• Seat Number: ${row.seat_no || 'N/A'}
• Roll Number: ${row.roll_no || 'N/A'}
• Division: ${row.division || '—'}
• Total Missed Evaluations: ${row.total_absences}

Sincerely,
Office of the Controller of Examinations
Academic Affairs Committee`
              window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            <Mail size={12} />
            <span>Email</span>
          </button>

          <Link
            to={`/students/${encodeURIComponent(row.student_id)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text)',
              textDecoration: 'none',
              padding: '4px 8px',
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
        </div>
      ),
    },
  ]

  // Columns for All Records (individual component) view
  const recordColumns: Column<AbsentStudentItem>[] = [
    {
      key: 'roll_no',
      header: 'Seat / Roll',
      width: '100px',
      sticky: true,
      render: (row) => (
        <div>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
            {row.roll_no || row.seat_no || row.student_id}
          </span>
          {row.roll_no && row.seat_no && (
            <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Seat: {row.seat_no}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Student Name',
      minWidth: '150px',
      maxWidth: '240px',
      wrap: true,
      render: (row) => {
        const studentTotal = studentAbsenceCountMap[row.student_id] || 1
        return (
          <div>
            <Link
              to={`/students/${encodeURIComponent(row.student_id)}`}
              style={{
                fontWeight: 600,
                color: 'var(--text)',
                textDecoration: 'none',
                display: 'inline-block',
                lineHeight: 1.3,
              }}
              className="hover-underline"
              title={row.name}
            >
              {toTitleCase(row.name)}
            </Link>
            {studentTotal > 1 && (
              <div style={{ marginTop: '2px' }}>
                <span
                  title={`Student has ${studentTotal} total absences across courses. Click to group by student.`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearchQuery(row.roll_no || row.seat_no || row.name)
                    setViewMode('grouped')
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    background: 'var(--status-warning-bg)',
                    color: 'var(--status-warning-text)',
                    border: '1px solid var(--status-warning-border)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>{studentTotal} Total Absences</span>
                  <span style={{ fontSize: '9px', opacity: 0.8 }}>&bull; group &rarr;</span>
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'division',
      header: 'Div',
      width: '50px',
      align: 'center',
      render: (row) => (
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
          {row.division || '—'}
        </span>
      ),
    },
    {
      key: 'course_code',
      header: 'Subject',
      minWidth: '130px',
      maxWidth: '200px',
      wrap: true,
      render: (row) => (
        <div>
          <Link
            to={`/subjects/${encodeURIComponent(row.course_code)}`}
            style={{
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
            }}
            className="hover-underline"
          >
            {row.course_code}
          </Link>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.2,
              marginTop: '1px',
            }}
            title={row.course_name}
          >
            {row.course_name}
          </div>
        </div>
      ),
    },
    {
      key: 'component',
      header: 'Component',
      width: '90px',
      align: 'center',
      render: (row) => (
        <span
          className="font-mono"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-active)',
            color: 'var(--text)',
          }}
        >
          {row.component}
        </span>
      ),
    },
    {
      key: 'raw_text',
      header: 'Marker',
      width: '75px',
      align: 'center',
      render: (row) => (
        <span
          className="font-mono"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            border: '1px solid var(--status-warning-border)',
            letterSpacing: '0.04em',
          }}
        >
          {row.raw_text || 'AB'}
        </span>
      ),
    },
    {
      key: 'overall_result',
      header: 'Result',
      width: '100px',
      align: 'center',
      render: (row) => {
        const outcome = (row.overall_result || '').toUpperCase()
        const tone: 'pass' | 'fail' | 'warn' = outcome.includes('PASS')
          ? 'pass'
          : outcome.includes('FAIL')
          ? 'fail'
          : 'warn'
        return <StatusBadge tone={tone} size="sm" label={outcome || 'UNRESOLVED'} />
      },
    },
    {
      key: 'actions',
      header: '',
      width: '180px',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            title={`Open notice for ${row.name} in Outlook`}
            onClick={(e) => {
              e.preventDefault()
              const email = (row as any).email || `${row.roll_no || row.student_id}@student.univ.edu`
              const subject = `Examination Absence Notice: ${row.course_code} (${row.component}) - ${toTitleCase(row.name)}`
              const formattedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
              const body = `ABSENTEE MAKE-UP EXAMINATION NOTIFICATION
Date: ${formattedDate}
To: ${toTitleCase(row.name)} (${row.seat_no || row.roll_no || row.student_id})
Division: ${row.division || '—'}
Subject: Official Documentation Submission for Missed Examination

Dear ${toTitleCase(row.name)},

University examination records indicate your absence during the following examination component:
• Course: ${row.course_name} (${row.course_code})
• Component: ${row.component}
• Absent Marker: ${row.raw_text || 'AB'}

If your absence was due to verified medical or institutional emergencies, please submit your supporting documentation to the Examination Cell within five (5) business days to confirm your make-up evaluation eligibility.

Student Details:
• Student Name: ${toTitleCase(row.name)}
• Seat Number: ${row.seat_no || 'N/A'}
• Roll Number: ${row.roll_no || 'N/A'}
• Division: ${row.division || '—'}

Sincerely,
Examination Cell & Department Faculty`
              window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            <Mail size={12} />
            <span>Email</span>
          </button>

          <Link
            to={`/students/${encodeURIComponent(row.student_id)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text)',
              textDecoration: 'none',
              padding: '4px 8px',
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
        </div>
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
      <style>{`
        @media screen {
          .print-absent-view {
            display: none !important;
          }
        }
        @page {
          size: landscape;
          margin: 10mm 12mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .sidebar, .top-bar, .top-header, .header, .card, nav, button, select, input, .pagination, .stats-row {
            display: none !important;
          }
          .print-absent-view, .print-absent-view * {
            visibility: visible;
          }
          .print-absent-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box !important;
          }
          .print-absent-view table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-absent-view thead {
            display: table-header-group !important;
          }
          .print-absent-view tbody {
            display: table-row-group !important;
          }
          .print-absent-view tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-absent-view th, .print-absent-view td {
            display: table-cell !important;
            border: 1px solid #94a3b8 !important;
            padding: 4px 6px !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
          }
          .print-absent-view th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            text-align: left;
          }
        }
      `}</style>

      {/* Page Header */}
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
            <UserX size={14} />
            <span>ABSENTEEISM AUDIT</span>
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
            Absent Students Audit
          </h1>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              margin: 'var(--space-1) 0 0 0',
            }}
          >
            Authoritative log of students with recorded absent markers (A, AB, ABS, ABSENT) in examination components.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link
            to="/follow-ups"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <span>Draft Notice</span>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            loading={exporting}
            icon={<Download size={14} />}
            title="Export filtered absent records to Excel (.xlsx)"
          >
            Export to Excel (.xlsx)
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrintRoster}
            disabled={printing || total === 0}
            loading={printing}
            icon={<Printer size={14} />}
            title="Print complete absent students roster"
          >
            Print Roster
          </Button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      {total > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <AlertTriangle size={14} style={{ color: 'var(--status-warning-text)' }} />
              <span>Absence Incidents</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {total.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total unattempted evaluations
            </div>
          </GlassCard>

          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <Users size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>Absent Students</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {distinctStudents}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Distinct students with absences
            </div>
          </GlassCard>

          <GlassCard elevation={1} padding="md">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <BookOpen size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>Affected Courses</span>
            </div>
            <div
              className="tabular-nums font-mono"
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--text)',
                marginTop: '4px',
                lineHeight: 1.2,
              }}
            >
              {distinctCourses}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Courses with absent evaluations
            </div>
          </GlassCard>
        </div>
      )}

      {/* Filter Bar */}
      <GlassCard elevation={1} padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ flex: '1 1 280px', maxWidth: '380px' }}>
            <SearchField
              placeholder="Search by student name, roll no, seat no..."
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search absent students"
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            {/* Division Filter */}
            <div style={{ minWidth: '140px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Divisions' },
                  { value: 'A', label: 'Division A' },
                  { value: 'B', label: 'Division B' },
                ]}
                value={divisionFilter}
                onChange={handleDivisionChange}
                size="sm"
                ariaLabel="Filter by Division"
              />
            </div>

            {/* Course Filter */}
            <div style={{ minWidth: '180px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Subjects' },
                  ...availableCourses.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
                ]}
                value={courseFilter}
                onChange={handleCourseChange}
                size="sm"
                ariaLabel="Filter by Subject"
              />
            </div>

            {/* Component Filter */}
            <div style={{ minWidth: '160px' }}>
              <Listbox
                options={[
                  { value: '', label: 'All Components' },
                  ...availableComponents.map((comp) => ({ value: comp, label: comp })),
                ]}
                value={componentFilter}
                onChange={handleComponentChange}
                size="sm"
                ariaLabel="Filter by Component"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Error Banner */}
      {error && (
        <ErrorBanner
          error={error}
          title="Could not load absent student records"
          onRetry={fetchAbsentList}
        />
      )}

      {/* Grouped Absence Severity Breakdown (Dynamic Division Partition) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Group 1: Absent in 1-2 subjects */}
        <GlassCard
          variant="glass-2"
          padding="md"
          style={{
            cursor: 'pointer',
            border: severityFilter === 'isolated' ? '1px solid var(--action-primary-bg)' : undefined,
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => {
            setSeverityFilter((prev) => (prev === 'isolated' ? 'all' : 'isolated'))
            setViewMode('grouped')
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
              Absent in 1–2 Subjects {severityFilter === 'isolated' && '(Selected)'}
            </div>
            <StatusBadge
              tone={isolatedCandidates.length > 0 ? 'warn' : 'info'}
              size="sm"
              label={`${isolatedCandidates.length} Candidate${isolatedCandidates.length === 1 ? '' : 's'}`}
            />
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Isolated component absence. Candidates may be eligible for immediate make-up re-evaluation. Click card to filter table.
          </p>
          {isolatedCandidates.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              No candidates with isolated absences in the active filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {isolatedCandidates.map((s) => (
                <div
                  key={s.student_id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text)' }}>
                      {toTitleCase(s.name)} {s.seat_no ? `(${s.seat_no})` : ''} {s.division ? `· Div ${s.division}` : ''}
                    </strong>
                    <StatusBadge
                      tone={(s.overall_result || '').toUpperCase().includes('PASS') ? 'pass' : 'fail'}
                      size="sm"
                      label={`${s.total_absences} Missed`}
                    />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Missed in: <strong>{s.courses.map((c) => c.course_code).join(', ')}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Group 2: Absent in 3+ subjects (Multiple / Critical) */}
        <GlassCard
          variant="glass-2"
          padding="md"
          style={{
            cursor: 'pointer',
            border: severityFilter === 'extended' ? '1px solid var(--action-primary-bg)' : undefined,
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => {
            setSeverityFilter((prev) => (prev === 'extended' ? 'all' : 'extended'))
            setViewMode('grouped')
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>
              Absent in 3+ Subjects (Multiple / Critical) {severityFilter === 'extended' && '(Selected)'}
            </div>
            <StatusBadge
              tone={extendedCandidates.length > 0 ? 'fail' : 'info'}
              size="sm"
              label={`${extendedCandidates.length} Candidate${extendedCandidates.length === 1 ? '' : 's'}`}
            />
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Chronic or extended absence across multiple course units. Requires administrative consultation. Click card to filter table.
          </p>
          {extendedCandidates.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              No candidates with chronic/extended absences in the active filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {extendedCandidates.map((s) => (
                <div
                  key={s.student_id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text)' }}>
                      {toTitleCase(s.name)} {s.seat_no ? `(${s.seat_no})` : ''} {s.division ? `· Div ${s.division}` : ''}
                    </strong>
                    <StatusBadge
                      tone={(s.overall_result || '').toUpperCase().includes('PASS') ? 'pass' : 'fail'}
                      size="sm"
                      label={`${s.total_absences} Missed`}
                    />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Missed {s.courses.length} subjects ({s.total_absences} total evaluations): <strong>{s.courses.map((c) => c.course_code).join(', ')}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '8px' }}>
            <Link
              to="/follow-ups"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text)',
                textDecoration: 'underline',
              }}
            >
              Draft Official Notice in Follow-ups &rarr;
            </Link>
          </div>
        </GlassCard>
      </div>

      {/* View Mode Segmented Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginTop: '-4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              background: 'var(--surface-hover)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: viewMode === 'grouped' ? 600 : 500,
                background: viewMode === 'grouped' ? 'var(--action-primary-bg)' : 'transparent',
                color: viewMode === 'grouped' ? 'var(--action-primary-text)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              title="Group multiple absence records by individual student"
            >
              <Users size={13} />
              <span>Group by Student ({groupedStudents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('records')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: viewMode === 'records' ? 600 : 500,
                background: viewMode === 'records' ? 'var(--action-primary-bg)' : 'transparent',
                color: viewMode === 'records' ? 'var(--action-primary-text)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              title="View all individual evaluation absence records"
            >
              <List size={13} />
              <span>All Records ({records.length})</span>
            </button>
          </div>

          {severityFilter !== 'all' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <StatusBadge
                tone={severityFilter === 'extended' ? 'fail' : 'warn'}
                size="sm"
                label={severityFilter === 'extended' ? 'Filtered: 3+ Subjects' : 'Filtered: 1–2 Subjects'}
              />
              <button
                type="button"
                onClick={() => setSeverityFilter('all')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {viewMode === 'grouped'
            ? `Showing ${groupedStudents.length} distinct absent student${groupedStudents.length === 1 ? '' : 's'} (${records.length} unattempted evaluations)`
            : `Showing ${records.length} component absence records`}
        </div>
      </div>

      {/* Main Table / Empty / Loading */}
      {loading && !records.length ? (
        <LoadingState message="Fetching absent records from database..." />
      ) : !loading && !records.length ? (
        <EmptyState
          title="No Absent Students Found"
          description={
            hasActiveFilters
              ? 'No absent records matched your specified filters. Try clearing your search or selecting different options.'
              : 'No student absence records (A, AB, ABS, ABSENT) were detected in the active marksheet dataset.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Reset All Filters
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'grouped' ? (
        <DataTable<GroupedAbsentStudent>
          columns={groupedColumns}
          data={pagedGrouped}
          keyExtractor={(item) => item.student_id}
          isLoading={loading}
          showDensityToggle={true}
          defaultDensity="comfortable"
          showPagination={groupedStudents.length > pageSize}
          serverTotal={groupedStudents.length}
          currentPage={groupedPage}
          onPageChange={setGroupedPage}
          pageSize={pageSize}
        />
      ) : (
        <DataTable<AbsentStudentItem>
          columns={recordColumns}
          data={pagedRecords}
          keyExtractor={(item, idx) => `${item.student_id}-${item.course_code}-${item.component}-${idx}`}
          isLoading={loading}
          showDensityToggle={true}
          defaultDensity="comfortable"
          showPagination={records.length > pageSize}
          serverTotal={records.length}
          currentPage={recordsPage}
          onPageChange={setRecordsPage}
          pageSize={pageSize}
        />
      )}

      {/* Hidden Print Container for Clean Roster Printing */}
      {printRecords && printRecords.length > 0 && (
      <div className="print-absent-view">
        <div style={{ marginBottom: '14px', borderBottom: '2px solid #0f172a', paddingBottom: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '16pt', fontWeight: 800 }}>EduQuery &mdash; Absent Students Audit Roster</h1>
          <div style={{ fontSize: '9pt', color: '#475569', marginTop: '4px' }}>
            Generated on {new Date().toLocaleDateString()} | Total Incidents: {recordsToPrint.length} | Total Distinct Students: {distinctStudents}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Roll No</th>
              <th style={{ width: '12%' }}>Seat No</th>
              <th style={{ width: '22%' }}>Student Name</th>
              <th style={{ width: '6%' }}>Div</th>
              <th style={{ width: '12%' }}>Course Code</th>
              <th style={{ width: '20%' }}>Course Title</th>
              <th style={{ width: '8%' }}>Comp</th>
              <th style={{ width: '8%' }}>Marker</th>
            </tr>
          </thead>
          <tbody>
            {recordsToPrint.map((item, idx) => (
              <tr key={`print-${item.student_id}-${item.course_code}-${item.component}-${idx}`}>
                <td style={{ fontWeight: 600 }}>{item.roll_no || '—'}</td>
                <td>{item.seat_no || '—'}</td>
                <td style={{ fontWeight: 600 }}>{toTitleCase(item.name)}</td>
                <td style={{ textAlign: 'center' }}>{item.division || '—'}</td>
                <td style={{ fontWeight: 600 }}>{item.course_code}</td>
                <td>{item.course_name}</td>
                <td>{item.component}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.raw_text || 'AB'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

export default AbsentStudentsPage
