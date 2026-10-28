import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useSession } from '../context/SessionContext'
import { getStudents, getSubjects } from '../api/client'
import type { CourseItem, StudentSummaryItem } from '../api/types'
import {
  BarChart3,
  Users,
  BookOpen,
  ShieldCheck,
  Database,
  UploadCloud,
  Sun,
  Moon,
  Laptop,
  Palette,
  Search,
  Compass,
  UserX,
  AlertOctagon,
  ArrowRight,
  GraduationCap,
} from 'lucide-react'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  category: 'Pages' | 'Actions' | 'Theme' | 'Students' | 'Courses'
  action: () => void
  badge?: string
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [studentResults, setStudentResults] = useState<StudentSummaryItem[]>([])
  const [cachedSubjects, setCachedSubjects] = useState<CourseItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { session, hasActiveSession } = useSession()

  // Preload subjects when palette opens to allow instant code & title search
  useEffect(() => {
    if (isOpen && cachedSubjects.length === 0) {
      getSubjects({ limit: 100 })
        .then((res) => {
          setCachedSubjects(res.items || [])
        })
        .catch(() => {})
    }
  }, [isOpen, cachedSubjects.length])

  // Live search for matching students and subjects when query changes
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setStudentResults([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      try {
        const studentRes = await getStudents({ query: q, limit: 4 })
        if (active && studentRes.items) {
          setStudentResults(studentRes.items)
        }
      } catch {
        // Fallback gracefully
      }
    }, 120)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  // Static navigation and actions commands
  const staticCommands: CommandItem[] = [
    {
      id: 'nav-overview',
      title: 'Overview',
      subtitle: 'Academic Analysis & Key Metrics',
      icon: <BarChart3 size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/')
        onClose()
      },
    },
    {
      id: 'nav-students',
      title: 'Students Roster',
      subtitle: 'Complete student directory with scores',
      icon: <Users size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/students')
        onClose()
      },
    },
    {
      id: 'nav-absent',
      title: 'Absent Students Audit',
      subtitle: 'Identify and print absenteeism records',
      icon: <UserX size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/absent')
        onClose()
      },
    },
    {
      id: 'nav-explore',
      title: 'Explore Academic Data',
      subtitle: 'Interactive multi-condition filter builder',
      icon: <Compass size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/explore')
        onClose()
      },
    },
    {
      id: 'nav-subjects',
      title: 'Curriculum & Subjects',
      subtitle: 'Course catalog & enrollment statistics',
      icon: <BookOpen size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/subjects')
        onClose()
      },
    },
    {
      id: 'nav-failures',
      title: 'Subject Failures Analysis',
      subtitle: 'Prioritized failure ranking across courses',
      icon: <AlertOctagon size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/subjects?tab=failures')
        onClose()
      },
    },
    {
      id: 'nav-quality',
      title: 'Data Quality & Anomalies',
      subtitle: 'Missing records, bounds violations & moderation audits',
      icon: <ShieldCheck size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/data-quality')
        onClose()
      },
    },
    {
      id: 'nav-imports',
      title: 'Dataset Management & Imports',
      subtitle: 'Manage workbook versions and active dataset',
      icon: <Database size={16} />,
      category: 'Pages',
      action: () => {
        navigate('/imports')
        onClose()
      },
    },
    {
      id: 'act-upload',
      title: 'Upload Marksheet',
      subtitle: 'Import new Excel (.xlsx) file into session',
      icon: <UploadCloud size={16} />,
      category: 'Actions',
      action: () => {
        navigate('/upload')
        onClose()
      },
    },
    {
      id: 'theme-light',
      title: 'Light Theme',
      subtitle: 'Crisp frosted-white monochrome interface',
      icon: <Sun size={16} />,
      category: 'Theme',
      action: () => {
        setTheme('light')
        onClose()
      },
    },
    {
      id: 'theme-dark',
      title: 'Dark Theme',
      subtitle: 'Smoked-black high-contrast interface',
      icon: <Moon size={16} />,
      category: 'Theme',
      action: () => {
        setTheme('dark')
        onClose()
      },
    },
    {
      id: 'theme-system',
      title: 'System Theme',
      subtitle: 'Match operating system appearance',
      icon: <Laptop size={16} />,
      category: 'Theme',
      action: () => {
        setTheme('system')
        onClose()
      },
    },
  ]

  if (import.meta.env.DEV) {
    staticCommands.push({
      id: 'nav-styleguide',
      title: 'Design System & Styleguide',
      subtitle: 'Interactive tokens, surfaces & component testbed',
      icon: <Palette size={16} />,
      category: 'Actions',
      action: () => {
        navigate('/styleguide')
        onClose()
      },
    })
  }

  // Filter commands by search query
  const q = query.trim().toLowerCase()

  // Matching dynamic courses
  const matchingCourses: CommandItem[] = q
    ? cachedSubjects
        .filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            (c.kind && c.kind.toLowerCase().includes(q))
        )
        .slice(0, 4)
        .map((c) => ({
          id: `course-${c.code}`,
          title: `${c.code} — ${c.name}`,
          subtitle: `${c.kind || 'Course'} • ${c.credits ?? 0} Credits • ${c.enrolled_students_count ?? 0} Students`,
          icon: <BookOpen size={16} />,
          category: 'Courses',
          action: () => {
            navigate(`/subjects/${c.code}`)
            onClose()
          },
        }))
    : []

  // Matching dynamic students
  const matchingStudents: CommandItem[] = studentResults.map((s) => ({
    id: `student-${s.student_id}`,
    title: s.name,
    subtitle: `Seat: ${s.seat_no || '—'} • Roll: ${s.roll_no || '—'} • Div: ${s.division || '—'}${
      s.sgpi ? ` • SGPI: ${Number(s.sgpi).toFixed(2)}` : ''
    }`,
    icon: <GraduationCap size={16} />,
    category: 'Students',
    badge: s.overall_result || undefined,
    action: () => {
      navigate(`/students/${s.student_id}`)
      onClose()
    },
  }))

  const matchingStatic = staticCommands.filter((cmd) => {
    if (!q) return true
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    )
  })

  // Build flattened list for keyboard index selection
  const allFilteredItems: CommandItem[] = [
    ...matchingStudents,
    ...matchingCourses,
    ...matchingStatic,
  ]

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [isOpen])

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % (allFilteredItems.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(
        (prev) => (prev - 1 + allFilteredItems.length) % (allFilteredItems.length || 1)
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allFilteredItems[selectedIndex]) {
        allFilteredItems[selectedIndex].action()
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeEl = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]')
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  // Categorize for grouped display
  const categories: Array<{ name: string; items: CommandItem[] }> = []

  if (matchingStudents.length > 0) {
    categories.push({ name: 'Students', items: matchingStudents })
  }
  if (matchingCourses.length > 0) {
    categories.push({ name: 'Courses & Curriculum', items: matchingCourses })
  }

  const pagesItems = matchingStatic.filter((c) => c.category === 'Pages')
  if (pagesItems.length > 0) {
    categories.push({ name: 'Pages & Views', items: pagesItems })
  }

  const actionsItems = matchingStatic.filter((c) => c.category === 'Actions')
  if (actionsItems.length > 0) {
    categories.push({ name: 'Actions', items: actionsItems })
  }

  const themeItems = matchingStatic.filter((c) => c.category === 'Theme')
  if (themeItems.length > 0) {
    categories.push({ name: 'Theme & Appearance', items: themeItems })
  }

  let runningItemIndex = 0

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="glass-3"
        style={{
          width: '100%',
          maxWidth: '580px',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--glass-border)',
          background: 'var(--surface-card)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-hover)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a student name, course code, or jump to page..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              color: 'var(--text)',
              fontSize: '15px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              padding: '3px 8px',
              background: 'var(--surface-active)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              lineHeight: 1.2,
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Grouped Command list with Custom Glass Scrollbar */}
        <div
          ref={listRef}
          role="listbox"
          className="glass-scrollbar"
          style={{
            maxHeight: 'min(420px, 60vh)',
            overflowY: 'auto',
            padding: '10px 12px 18px 12px',
          }}
        >
          {allFilteredItems.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-8) var(--space-4)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              No results found for "{query}"
            </div>
          ) : (
            categories.map((group) => (
              <div key={group.name} style={{ marginBottom: '10px' }}>
                <div
                  style={{
                    padding: '6px 12px 6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {group.name}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {group.items.map((cmd) => {
                    const currentIndex = runningItemIndex++
                    const isSelected = currentIndex === selectedIndex

                    return (
                      <div
                        key={cmd.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: isSelected ? 'var(--surface-hover)' : 'transparent',
                          border: isSelected
                            ? '1px solid var(--border-strong)'
                            : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: isSelected
                                ? 'var(--action-primary-bg)'
                                : 'var(--surface-active)',
                              color: isSelected
                                ? 'var(--action-primary-text)'
                                : 'var(--text-secondary)',
                              flexShrink: 0,
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            {cmd.icon}
                          </span>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 600,
                                color: 'var(--text)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {cmd.title}
                            </div>
                            {cmd.subtitle && (
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: '1px',
                                }}
                              >
                                {cmd.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0,
                            marginLeft: '12px',
                          }}
                        >
                          {cmd.badge && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs)',
                                background:
                                  cmd.badge.toUpperCase() === 'PASS' ||
                                  cmd.badge.toUpperCase() === 'PASSED'
                                    ? 'var(--status-success-bg)'
                                    : 'var(--status-danger-bg)',
                                color:
                                  cmd.badge.toUpperCase() === 'PASS' ||
                                  cmd.badge.toUpperCase() === 'PASSED'
                                    ? 'var(--status-success-text)'
                                    : 'var(--status-danger-text)',
                              }}
                            >
                              {cmd.badge}
                            </span>
                          )}

                          {isSelected && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text)',
                                background: 'var(--surface-active)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <span>Open</span>
                              <ArrowRight size={11} />
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Hints with Clean Monochrome Styling */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'var(--surface-active)', border: '1px solid var(--border)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>↑↓</kbd>
              Navigate
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'var(--surface-active)', border: '1px solid var(--border)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>↵</kbd>
              Select
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'var(--surface-active)', border: '1px solid var(--border)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>esc</kbd>
              Close
            </span>
          </div>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '220px',
              fontSize: '11px',
            }}
          >
            {hasActiveSession ? (session?.filename ? `Active: ${session.filename}` : 'Active Session') : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  )
}