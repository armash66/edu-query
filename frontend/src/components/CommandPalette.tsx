import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useSession } from '../context/SessionContext'
import { getStudents, getSubjects } from '../api/client'
import type { CourseItem } from '../api/types'
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
  UserX,
  AlertOctagon,
} from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  category: 'Navigation' | 'Theme' | 'Actions' | 'Students' | 'Subjects'
  action: () => void
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dynamicResults, setDynamicResults] = useState<CommandItem[]>([])
  const [cachedSubjects, setCachedSubjects] = useState<CourseItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { hasActiveSession } = useSession()

  // Preload subjects when palette opens to allow instant code & title search
  useEffect(() => {
    if (isOpen && cachedSubjects.length === 0) {
      getSubjects({ limit: 50 }).then((res) => {
        setCachedSubjects(res.items || [])
      }).catch(() => {})
    }
  }, [isOpen, cachedSubjects.length])

  // Live search for matching students and subjects when query changes
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setDynamicResults([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      const items: CommandItem[] = []

      // Matching courses from preloaded cache
      const qLower = q.toLowerCase()
      const matchingCourses = cachedSubjects.filter(
        (c) => c.code.toLowerCase().includes(qLower) || c.name.toLowerCase().includes(qLower)
      ).slice(0, 3)

      matchingCourses.forEach((c) => {
        items.push({
          id: `subject-${c.code}`,
          title: `${c.code} — ${c.name}`,
          subtitle: `${c.kind || 'Course'} • ${c.credits ?? 0} Credits • ${c.enrolled_students_count ?? 0} Students`,
          icon: <BookOpen size={16} />,
          category: 'Subjects',
          action: () => {
            navigate(`/subjects/${c.code}`)
            onClose()
          },
        })
      })

      // Search matching students from API
      try {
        const studentRes = await getStudents({ query: q, limit: 3 })
        if (active && studentRes.items) {
          studentRes.items.forEach((s) => {
            items.push({
              id: `student-${s.student_id}`,
              title: s.name,
              subtitle: `Seat: ${s.seat_no || '—'} • Roll: ${s.roll_no || '—'} • Div: ${s.division || '—'} (${s.overall_result || 'Result'})`,
              icon: <Users size={16} />,
              category: 'Students',
              action: () => {
                navigate(`/students/${s.student_id}`)
                onClose()
              },
            })
          })
        }
      } catch {
        // Fallback gracefully
      }

      if (active) {
        setDynamicResults(items)
      }
    }, 120)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, cachedSubjects, navigate, onClose])

  const commands: CommandItem[] = [
    {
      id: 'nav-overview',
      title: 'Overview',
      subtitle: 'Academic Analysis & Key Metrics',
      icon: <BarChart3 size={16} />,
      category: 'Navigation',
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
      category: 'Navigation',
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
      category: 'Navigation',
      action: () => {
        navigate('/students?preset=absent')
        onClose()
      },
    },
    {
      id: 'nav-explore',
      title: 'Explore Academic Data',
      subtitle: 'Interactive multi-condition filter builder',
      icon: <Search size={16} />,
      category: 'Navigation',
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
      category: 'Navigation',
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
      category: 'Navigation',
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
      category: 'Navigation',
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
      category: 'Navigation',
      action: () => {
        navigate('/imports')
        onClose()
      },
    },
    {
      id: 'nav-upload',
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
    {
      id: 'nav-styleguide',
      title: 'Design System & Styleguide',
      subtitle: 'Interactive tokens, surfaces & component testbed',
      icon: <Palette size={16} />,
      category: 'Actions',
      action: () => {
        navigate('/styleguide')
        onClose()
      },
    },
  ]

  const filteredStatic = commands.filter((cmd) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    )
  })

  // Dynamic results (matching students and subjects) appear first when searching
  const filteredCommands = [...dynamicResults, ...filteredStatic]

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
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1)
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action()
      }
    }
  }

  if (!isOpen) return null

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
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
          maxWidth: '560px',
          borderRadius: 'var(--radius-panel)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border)',
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
            placeholder="Search students, subjects, or jump to page..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              color: 'var(--text)',
              fontSize: 'var(--text-base)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              background: 'var(--surface-active)',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Command list with custom glass scrollbar */}
        <ul
          ref={listRef}
          role="listbox"
          className="glass-scrollbar"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 'var(--space-2)',
            maxHeight: '360px',
            overflowY: 'auto',
          }}
        >
          {filteredCommands.length === 0 ? (
            <li
              style={{
                padding: 'var(--space-6)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              No commands matching "{query}"
            </li>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex

              return (
                <li
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--surface-hover)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected
                          ? 'var(--action-primary-bg)'
                          : 'var(--surface-hover)',
                        color: isSelected
                          ? 'var(--action-primary-text)'
                          : 'var(--text-secondary)',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {cmd.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                          color: 'var(--text)',
                        }}
                      >
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {cmd.category}
                  </span>
                </li>
              )
            })
          )}
        </ul>

        {/* Footer hints with generous insets from rounded corners */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>{hasActiveSession ? 'Active Session' : 'Ready'}</span>
        </div>
      </div>
    </div>
  )
}
