import React, { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Users,
  UserX,
  Compass,
  BookOpen,
  UserCheck,
  ShieldAlert,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useHealth } from '../context/HealthContext'
import { useSession } from '../context/SessionContext'
import { BootScreen } from './BootScreen'
import { IconButton } from '../ui/IconButton'
import { ThemeMenu } from './ThemeMenu'
import { GlobalSearchTrigger } from './GlobalSearchTrigger'
import { getOverviewSummary } from '../api/client'

const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))
const ConfirmDialog = lazy(() => import('./ConfirmDialog').then((m) => ({ default: m.ConfirmDialog })))

export const AppShell: React.FC = () => {
  const { health, error: healthError, refreshHealth } = useHealth()
  const { session, hasActiveSession, deleteSession } = useSession()
  const location = useLocation()
  const navigate = useNavigate()

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isFooterMenuOpen, setIsFooterMenuOpen] = useState(false)
  const footerMenuRef = useRef<HTMLDivElement>(null)

  const handleDeleteSessionConfirm = async () => {
    setDeleting(true)
    try {
      await deleteSession()
      await refreshHealth()
      setIsDeleteDialogOpen(false)
      setIsFooterMenuOpen(false)
      navigate('/upload')
    } catch (err) {
      console.error('Failed to delete session:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Sidebar Rail State (persisted in localStorage)
  const [isRail, setIsRail] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eduquery_sidebar_rail') === 'true'
    } catch {
      return false
    }
  })
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [absentBadge, setAbsentBadge] = useState<string | null>(null)
  const [anomalyBadge, setAnomalyBadge] = useState<string | null>(null)

  useEffect(() => {
    if (!hasActiveSession) return
    let isMounted = true
    getOverviewSummary()
      .then((summary) => {
        if (!isMounted) return
        if (summary?.kpis?.absent_students && summary.kpis.absent_students > 0) {
          setAbsentBadge(String(summary.kpis.absent_students))
        } else {
          setAbsentBadge(null)
        }
        if (summary?.kpis?.needs_attention_count && summary.kpis.needs_attention_count > 0) {
          setAnomalyBadge(String(summary.kpis.needs_attention_count))
        } else {
          setAnomalyBadge(null)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [hasActiveSession, location.pathname])

  const toggleRail = () => {
    setIsRail((prev) => {
      const next = !prev
      try {
        localStorage.setItem('eduquery_sidebar_rail', String(next))
      } catch {
        // Ignore
      }
      return next
    })
  }

  // Close footer menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (footerMenuRef.current && !footerMenuRef.current.contains(e.target as Node)) {
        setIsFooterMenuOpen(false)
      }
    }
    if (isFooterMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isFooterMenuOpen])

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Dynamic Page Title & Muted Subtitle
  const getPageTitle = (pathname: string): { title: string; subtitle?: string } => {
    if (pathname === '/upload') return { title: 'Analyze Marksheet', subtitle: 'Upload a marksheet to begin' }
    if (pathname === '/') {
      return hasActiveSession
        ? { title: 'Overview', subtitle: 'Command center & cohort performance' }
        : { title: 'EduQuery', subtitle: 'Result Management Assistant' }
    }
    if (pathname === '/students') return { title: 'Students', subtitle: 'Cohort roster, merit list & result slips' }
    if (pathname.startsWith('/students/')) return { title: 'Student Breakdown', subtitle: 'Component evaluation & result slip' }
    if (pathname === '/subjects') return { title: 'Subjects', subtitle: 'Curriculum catalog, electives & failure ranking' }
    if (pathname.startsWith('/subjects/')) return { title: 'Subject Roster', subtitle: 'Student evaluations & pass marks' }
    if (pathname === '/explore') return { title: 'Explore', subtitle: 'Interactive criteria builder & saved views' }
    if (pathname === '/absent' || pathname === '/absent-students') return { title: 'Absent Students', subtitle: 'Grouped absentee analysis & notices' }
    if (pathname === '/follow-ups') return { title: 'Follow-ups', subtitle: 'Remedial groups, peer mentoring & notices' }
    if (pathname === '/data-quality' || pathname === '/quality') return { title: 'Data Quality', subtitle: 'Pre-declaration verification & anomaly review' }
    if (pathname === '/reports') return { title: 'Reports', subtitle: 'Print-ready institutional documents & exports' }
    return { title: 'EduQuery' }
  }

  const { title, subtitle } = getPageTitle(location.pathname)

  // 8 Canonical Nav Items in 3 Labeled Groups
  interface NavItem {
    to: string
    label: string
    icon: React.ReactNode
    end?: boolean
    badge?: string
    badgeTone?: 'neutral' | 'amber'
  }

  interface NavGroup {
    label: string
    items: NavItem[]
  }

  const navGroups: NavGroup[] = [
    {
      label: 'Analyze',
      items: [
        { to: '/', label: 'Overview', icon: <BarChart3 size={18} />, end: true },
        { to: '/students', label: 'Students', icon: <Users size={18} /> },
        { to: '/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
      ],
    },
    {
      label: 'Investigate',
      items: [
        { to: '/explore', label: 'Explore', icon: <Compass size={18} /> },
        { to: '/absent', label: 'Absent Students', icon: <UserX size={18} />, badge: absentBadge ?? undefined, badgeTone: 'neutral' },
      ],
    },
    {
      label: 'Act',
      items: [
        { to: '/follow-ups', label: 'Follow-ups', icon: <UserCheck size={18} /> },
        { to: '/data-quality', label: 'Data Quality', icon: <ShieldAlert size={18} />, badge: anomalyBadge ?? undefined, badgeTone: 'amber' },
        { to: '/reports', label: 'Reports', icon: <FileText size={18} /> },
      ],
    },
  ]

  // Dataset status details
  const studentCount = session?.students_count ?? health?.database?.students_count ?? null
  const courseCount = session?.courses_count ?? health?.database?.courses_count ?? null
  const datasetName = session?.filename || 'Active Marksheet'

  // Compute status: strictly "Temporary session · expires in N min"
  const isTemporary = session?.mode === 'temporary' || (!session?.mode && Boolean(session?.expires_at))
  let datasetStatusLabel = 'Temporary session'
  if (session?.expires_at) {
    const msLeft = new Date(session.expires_at).getTime() - Date.now()
    const minLeft = Math.max(1, Math.round(msLeft / 60000))
    datasetStatusLabel = `Temporary session · expires in ${minLeft} min`
  } else if (!isTemporary && session?.active) {
    datasetStatusLabel = 'Active session'
  }

  // Opening page flow: if no active session or currently on /upload, render without sidebar and header!
  if (!hasActiveSession || location.pathname === '/upload') {
    return (
      <div className="opening-flow-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <a href="#main-content-region" className="skip-link skip-to-content">
          Skip to main content
        </a>
        <main id="main-content-region" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>
    )
  }

  // If backend is waking up and no local session/data is loaded, show polite BootScreen
  const isColdStart = healthError && healthError.status === 0 && !hasActiveSession

  return (
    <div className="app-container">
      {/* Skip to Content for Accessibility */}
      <a href="#main-content-region" className="skip-link skip-to-content">
        Skip to main content
      </a>

      {/* Floating Inset Sidebar (16px margin from viewport edges, 24px radius, glass-2, padded inside) */}
      <aside className={`sidebar glass-2 ${isRail ? 'rail' : ''}`} aria-label="Main Navigation">
        {/* Brand Block */}
        <div
          style={{
            padding: isRail ? '14px 0 10px 0' : '16px 16px 12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRail ? 'center' : 'space-between',
          }}
        >
          {!isRail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--action-primary-bg)',
                  color: 'var(--action-primary-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                EQ
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  EduQuery
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Result Management
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--action-primary-bg)',
                color: 'var(--action-primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 800,
              }}
              title="EduQuery Result Management"
            >
              EQ
            </div>
          )}
        </div>

        {/* 8 Items in 3 Labeled Groups */}
        <nav
          style={{
            flex: 1,
            padding: isRail ? '12px 6px' : '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {navGroups.map((group) => (
            <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {!isRail && (
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    padding: '4px 10px',
                  }}
                >
                  {group.label}
                </div>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={isRail ? item.label : undefined}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isRail ? 'center' : 'space-between',
                    padding: isRail ? '10px 0' : '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-sm)',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--action-primary-bg)' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    transition: 'all var(--transition-fast)',
                    minHeight: '38px',
                    position: 'relative',
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    {!isRail && <span>{item.label}</span>}
                  </div>

                  {!isRail && item.badge && (
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-pill)',
                        background:
                          item.badgeTone === 'amber'
                            ? 'var(--status-warning-bg)'
                            : 'var(--surface-hover)',
                        color:
                          item.badgeTone === 'amber'
                            ? 'var(--status-warning-text)'
                            : 'var(--text-secondary)',
                        border:
                          item.badgeTone === 'amber'
                            ? '1px solid var(--status-warning-border)'
                            : '1px solid var(--border)',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Block */}
        <div
          ref={footerMenuRef}
          style={{
            position: 'relative',
            padding: isRail ? '12px 6px' : '14px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Footer Popover Menu */}
          {isFooterMenuOpen && !isRail && (
            <div
              className="glass-3"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '12px',
                right: '12px',
                marginBottom: '8px',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 20,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsFooterMenuOpen(false)
                  navigate('/upload')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <RefreshCw size={14} />
                <span>Replace dataset</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFooterMenuOpen(false)
                  setIsDeleteDialogOpen(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-danger-text)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--status-danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={14} />
                <span>Delete data</span>
              </button>
            </div>
          )}

          {/* Dataset Status Line & Actions */}
          {!isRail ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={datasetName}
                >
                  {datasetName}
                </div>
                <div className="tabular-nums" style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {studentCount !== null ? `${studentCount} students` : ''}{courseCount !== null ? ` • ${courseCount} courses` : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '1px' }}>
                  {datasetStatusLabel}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <IconButton
                  aria-label="Dataset options menu"
                  title="Dataset options"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFooterMenuOpen((prev) => !prev)}
                  icon={<MoreHorizontal size={16} />}
                />
                <IconButton
                  aria-label={isRail ? 'Expand sidebar' : 'Collapse sidebar'}
                  variant="ghost"
                  size="sm"
                  onClick={toggleRail}
                  icon={<PanelLeftClose size={15} />}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <IconButton
                aria-label="Expand sidebar"
                variant="ghost"
                size="md"
                onClick={toggleRail}
                icon={<PanelLeftOpen size={18} />}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Sticky Glass-3 Top Bar */}
        <header className="top-bar">
          {/* Left: Page Title & Muted Desktop Subtitle */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
              flex: 1,
            }}
          >
            <h1
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.2,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={title}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="desktop-subtitle"
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  margin: '2px 0 0 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: AI Search + Theme Icon Only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GlobalSearchTrigger onClick={() => setIsCommandPaletteOpen(true)} />
            <ThemeMenu align="right" direction="down" shape="circle" />
          </div>
        </header>

        {/* Page Content Body Region */}
        <main id="main-content-region" tabIndex={-1} className="page-body">
          {isColdStart ? (
            <BootScreen onRetry={refreshHealth} errorMessage={healthError?.message} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation (< 768px) */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        <NavLink
          to="/"
          end
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <BarChart3 size={18} />
          <span>Overview</span>
        </NavLink>
        <NavLink
          to="/students"
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <Users size={18} />
          <span>Students</span>
        </NavLink>
        <NavLink
          to="/subjects"
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <BookOpen size={18} />
          <span>Subjects</span>
        </NavLink>
        <NavLink
          to="/explore"
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <Compass size={18} />
          <span>Explore</span>
        </NavLink>
        <NavLink
          to="/follow-ups"
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <UserCheck size={18} />
          <span>Follow-ups</span>
        </NavLink>
      </nav>

      {/* Modals & Dialogs */}
      <Suspense fallback={null}>
        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isDeleteDialogOpen && (
          <ConfirmDialog
            title="Delete Session Data"
            message="Are you sure you want to delete this dataset? All student data will be purged from session memory and client caches will be cleared. You will return to the opening upload screen."
            confirmLabel="Delete session and data"
            cancelLabel="Keep analysis"
            danger={true}
            loading={deleting}
            onConfirm={handleDeleteSessionConfirm}
            onCancel={() => setIsDeleteDialogOpen(false)}
          />
        )}
      </Suspense>
    </div>
  )
}
export default AppShell
