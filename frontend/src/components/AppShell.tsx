import React, { useState, useEffect, lazy, Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Users,
  BookOpen,
  ShieldCheck,
  Database,
  UploadCloud,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  Palette,
  Search,
  KeyRound,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useHealth } from '../context/HealthContext'
import { useSession } from '../context/SessionContext'
import { useTheme } from '../context/ThemeContext'
import { BootScreen } from './BootScreen'
import { IconButton } from '../ui/IconButton'
import { StatusBadge } from '../ui/StatusBadge'

const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))
const AdminKeyModal = lazy(() => import('./AdminKeyModal').then((m) => ({ default: m.AdminKeyModal })))
const ConfirmDialog = lazy(() => import('./ConfirmDialog').then((m) => ({ default: m.ConfirmDialog })))

export const AppShell: React.FC = () => {
  const { health, loading: healthLoading, error: healthError, refreshHealth } = useHealth()
  const { session, hasActiveSession, deleteSession } = useSession()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  // State
  const [isRail, setIsRail] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eduquery_sidebar_rail') === 'true'
    } catch {
      return false
    }
  })
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isAdminKeyOpen, setIsAdminKeyOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Persist rail preference
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

  // Dynamic Page Title
  const getPageTitle = (pathname: string): { title: string; subtitle?: string } => {
    if (pathname === '/upload') return { title: 'Upload Marksheet', subtitle: 'Analyze student workbook' }
    if (pathname === '/') {
      return hasActiveSession
        ? { title: 'Academic Analysis Overview', subtitle: 'Executive performance summary' }
        : { title: 'EduQuery Academic Portal', subtitle: 'Upload a marksheet to begin' }
    }
    if (pathname === '/students') return { title: 'Student Directory', subtitle: 'Search & individual breakdown' }
    if (pathname.startsWith('/students/')) return { title: 'Student Breakdown', subtitle: 'Detailed marks & evaluation' }
    if (pathname === '/subjects') return { title: 'Curriculum & Subjects', subtitle: 'Course performance & failure rates' }
    if (pathname.startsWith('/subjects/')) return { title: 'Subject Roster', subtitle: 'Student evaluations & pass marks' }
    if (pathname === '/data-quality') return { title: 'Data Quality & Anomalies', subtitle: 'Integrity checks & review audits' }
    if (pathname === '/imports') return { title: 'Dataset Management', subtitle: 'Active records & promotion log' }
    if (pathname === '/styleguide') return { title: 'Monochrome Glass Styleguide', subtitle: 'Component & token library' }
    return { title: 'EduQuery Faculty Portal' }
  }

  const handleDeleteSessionConfirm = async () => {
    setDeleting(true)
    try {
      await deleteSession()
      await refreshHealth()
      setIsDeleteDialogOpen(false)
      navigate('/upload')
    } finally {
      setDeleting(false)
    }
  }

  const { title, subtitle } = getPageTitle(location.pathname)
  const isTemporary = session?.mode === 'temporary' || (!session?.mode && hasActiveSession)

  // Navigation Items (Consolidated 5 Items)
  const mainNavItems = [
    { to: '/', label: 'Overview', icon: <BarChart3 size={18} />, end: true },
    { to: '/students', label: 'Students', icon: <Users size={18} /> },
    { to: '/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
    { to: '/data-quality', label: 'Data Quality', icon: <ShieldCheck size={18} /> },
    { to: '/imports', label: 'Datasets', icon: <Database size={18} /> },
  ]

  // If backend is waking up and no local session/data is loaded, show polite BootScreen
  const isColdStart = healthError && healthError.status === 0 && !hasActiveSession

  return (
    <div className="app-container">
      {/* Skip to Content for Screen Readers */}
      <a href="#main-content-region" className="skip-link skip-to-content">
        Skip to main content
      </a>

      {/* Desktop Floating Sidebar */}
      <aside className={`sidebar glass-2 ${isRail ? 'rail' : ''}`} aria-label="Main Navigation">
        {/* Brand / Header */}
        <div
          style={{
            padding: isRail ? 'var(--space-4) var(--space-2)' : 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRail ? 'center' : 'space-between',
          }}
        >
          {!isRail ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontWeight: 700,
                  fontSize: 'var(--text-md)',
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--action-primary-bg)',
                    color: 'var(--action-primary-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  EQ
                </div>
                <span>EduQuery</span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '2px',
                }}
              >
                Academic Intelligence
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
              title="EduQuery"
            >
              EQ
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            flex: 1,
            padding: isRail ? 'var(--space-3) var(--space-2)' : 'var(--space-4) var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            overflowY: 'auto',
          }}
        >
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={isRail ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: isRail ? 'center' : 'flex-start',
                gap: 'var(--space-3)',
                padding: isRail ? '12px 0' : '10px 14px',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                background: isActive ? 'var(--action-primary-bg)' : 'transparent',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition-fast)',
                minHeight: '44px',
              })}
            >
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
            </NavLink>
          ))}

          <div
            style={{
              margin: 'var(--space-3) var(--space-2)',
              borderTop: '1px solid var(--border)',
            }}
          />

          {/* Secondary Actions */}
          <NavLink
            to="/upload"
            title={isRail ? 'Upload Marksheet' : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'flex-start',
              gap: 'var(--space-3)',
              padding: isRail ? '12px 0' : '10px 14px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--action-primary-text)' : 'var(--text-secondary)',
              background: isActive ? 'var(--action-primary-bg)' : 'transparent',
              transition: 'all var(--transition-fast)',
              minHeight: '44px',
            })}
          >
            <span style={{ display: 'inline-flex' }} aria-hidden="true">
              <UploadCloud size={18} />
            </span>
            {!isRail && <span>Upload Marksheet</span>}
          </NavLink>

          <NavLink
            to="/styleguide"
            title={isRail ? 'Design Styleguide' : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'flex-start',
              gap: 'var(--space-3)',
              padding: isRail ? '12px 0' : '10px 14px',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              background: isActive ? 'var(--surface-active)' : 'transparent',
              transition: 'all var(--transition-fast)',
              minHeight: '44px',
            })}
          >
            <span style={{ display: 'inline-flex' }} aria-hidden="true">
              <Palette size={16} />
            </span>
            {!isRail && <span>Design System</span>}
          </NavLink>
        </nav>

        {/* Sidebar Footer */}
        <div
          style={{
            padding: isRail ? 'var(--space-3) var(--space-2)' : 'var(--space-4) var(--space-5)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {!isRail && hasActiveSession && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                Active Dataset
              </div>
              <div className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {session?.students_count ?? health?.database?.students_count ?? 0} Students &bull;{' '}
                {session?.courses_count ?? health?.database?.courses_count ?? 0} Courses
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'space-between',
            }}
          >
            {!isRail && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                v3.2 Mono Glass
              </span>
            )}
            <IconButton
              aria-label={isRail ? 'Expand sidebar' : 'Collapse sidebar into rail'}
              variant="ghost"
              size="sm"
              onClick={toggleRail}
              icon={isRail ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div>
              <h1
                style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Command Palette Trigger Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="touch-target-44"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '0 var(--space-3)',
                height: '36px',
                borderRadius: 'var(--radius-input)',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
              aria-label="Quick Jump... ⌘K (Open Command Palette)"
            >
              <Search size={14} />
              <span style={{ display: 'none' }} className="d-md-inline">
                Quick Jump...
              </span>
              <kbd
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--surface-active)',
                  border: '1px solid var(--border)',
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Session Status Badge */}
            {hasActiveSession ? (
              <StatusBadge
                tone="pass"
                size="sm"
                label={session?.mode === 'persistent' ? 'Persistent' : 'Active Session'}
              />
            ) : (
              <StatusBadge tone="info" size="sm" label="No Session" />
            )}

            {/* Refresh Health */}
            <IconButton
              aria-label="Refresh backend connection"
              variant="ghost"
              size="sm"
              onClick={() => refreshHealth()}
              icon={<RefreshCw size={15} className={healthLoading ? 'spin' : ''} />}
            />

            {/* Admin Key Modal Trigger */}
            <IconButton
              aria-label="Administrative Import Key"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdminKeyOpen(true)}
              icon={<KeyRound size={15} />}
            />

            {/* Theme Toggle (System / Light / Dark) */}
            <div
              className="glass-1"
              style={{
                display: 'inline-flex',
                padding: '2px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
              }}
            >
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-label={`Switch to ${t} theme`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-full)',
                    background: theme === t ? 'var(--action-primary-bg)' : 'transparent',
                    color: theme === t ? 'var(--action-primary-text)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {t === 'light' && <Sun size={13} />}
                  {t === 'dark' && <Moon size={13} />}
                  {t === 'system' && <Laptop size={13} />}
                </button>
              ))}
            </div>

            {/* Delete Session Button (Only if active temporary session) */}
            {hasActiveSession && isTemporary && (
              <IconButton
                aria-label="Delete session and data"
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                icon={<Trash2 size={15} />}
              />
            )}
          </div>
        </header>

        {/* Page Body */}
        <main id="main-content-region" className="page-body" role="main">
          {isColdStart ? (
            <BootScreen
              onRetry={refreshHealth}
              errorMessage={healthError ? healthError.message : undefined}
            />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Floating Bottom Navigation for Mobile Devices (< 768px) */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Modals & Dialogs (Lazy-loaded on demand) */}
      {isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
        </Suspense>
      )}

      {isAdminKeyOpen && (
        <Suspense fallback={null}>
          <AdminKeyModal isOpen={isAdminKeyOpen} onClose={() => setIsAdminKeyOpen(false)} />
        </Suspense>
      )}

      {isDeleteDialogOpen && (
        <Suspense fallback={null}>
          <ConfirmDialog
            title="Delete Analysis Session & Data"
            message="Are you sure you want to permanently delete this analysis session? All temporary marksheet files, extracted student records, and moderation reviews will be erased from the server immediately. This cannot be undone."
            confirmLabel="Delete session and data"
            cancelLabel="Keep analysis"
            danger={true}
            loading={deleting}
            onConfirm={handleDeleteSessionConfirm}
            onCancel={() => setIsDeleteDialogOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default AppShell
