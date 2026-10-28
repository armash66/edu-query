import React, { useState, useEffect, lazy, Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Users,
  BookOpen,
  ShieldCheck,
  Database,
  UploadCloud,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useHealth } from '../context/HealthContext'
import { useSession } from '../context/SessionContext'
import { BootScreen } from './BootScreen'
import { IconButton } from '../ui/IconButton'
import { ThemeMenu } from './ThemeMenu'
import { GlobalSearchTrigger } from './GlobalSearchTrigger'

const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })))

export const AppShell: React.FC = () => {
  const { health, error: healthError } = useHealth()
  const { session, hasActiveSession } = useSession()
  const location = useLocation()
  const navigate = useNavigate()

  // Sidebar Rail State (persisted in localStorage)
  const [isRail, setIsRail] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eduquery_sidebar_rail') === 'true'
    } catch {
      return false
    }
  })
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

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

  // Dynamic Page Title & Muted Subtitle
  const getPageTitle = (pathname: string): { title: string; subtitle?: string } => {
    if (pathname === '/upload') return { title: 'Upload Marksheet', subtitle: 'Analyze student workbook' }
    if (pathname === '/') {
      return hasActiveSession
        ? { title: 'Academic Analysis Overview', subtitle: 'Executive cohort performance summary' }
        : { title: 'EduQuery Academic Portal', subtitle: 'Upload a marksheet to begin' }
    }
    if (pathname === '/students') return { title: 'Student Directory', subtitle: 'Search & individual breakdown' }
    if (pathname.startsWith('/students/')) return { title: 'Student Breakdown', subtitle: 'Detailed marks & evaluation' }
    if (pathname === '/explore') return { title: 'Explore Academic Data', subtitle: 'Multi-condition filter builder' }
    if (pathname === '/absent' || pathname === '/absent-students') return { title: 'Absentee Roster', subtitle: 'Unattempted evaluations & missing marks' }
    if (pathname === '/failures') return { title: 'Curriculum Failure Summary', subtitle: 'Subject-wise failure distribution' }
    if (pathname === '/subjects') return { title: 'Curriculum & Subjects', subtitle: 'Course performance & failure rates' }
    if (pathname.startsWith('/subjects/')) return { title: 'Subject Roster', subtitle: 'Student evaluations & pass marks' }
    if (pathname === '/quality' || pathname === '/data-quality') return { title: 'Data Quality & Anomalies', subtitle: 'Integrity checks & review audits' }
    if (pathname === '/imports') return { title: 'Dataset Management', subtitle: 'Active records & versions' }
    if (pathname === '/styleguide') return { title: 'Design System', subtitle: 'Monochrome Glass tokens & components' }
    return { title: 'EduQuery Academic Portal' }
  }

  const { title, subtitle } = getPageTitle(location.pathname)

  // 5 Canonical Nav Items
  const mainNavItems = [
    { to: '/', label: 'Overview', icon: <BarChart3 size={18} />, end: true },
    { to: '/students', label: 'Students', icon: <Users size={18} /> },
    { to: '/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
    { to: '/data-quality', label: 'Data Quality', icon: <ShieldCheck size={18} /> },
    { to: '/imports', label: 'Datasets', icon: <Database size={18} /> },
  ]

  // Dataset status details
  const studentCount = session?.students_count ?? health?.database?.students_count ?? 145
  const courseCount = session?.courses_count ?? health?.database?.courses_count ?? 27
  const datasetName = session?.filename || 'Uploaded Marksheet'

  // Compute status: strictly "Saved dataset" or "Temporary session · expires in N min" (never "Persistent")
  const isTemporary = session?.mode === 'temporary' || (!session?.mode && Boolean(session?.expires_at))
  let datasetStatusLabel = 'Saved dataset'
  if (isTemporary) {
    if (session?.expires_at) {
      const msLeft = new Date(session.expires_at).getTime() - Date.now()
      const minLeft = Math.max(1, Math.round(msLeft / 60000))
      datasetStatusLabel = `Temporary session · expires in ${minLeft} min`
    } else {
      datasetStatusLabel = 'Temporary session'
    }
  }

  // If backend is waking up and no local session/data is loaded, show polite BootScreen
  const isColdStart = healthError && healthError.status === 0 && !hasActiveSession

  return (
    <div className="app-container">
      {/* Skip to Content for Accessibility */}
      <a href="#main-content-region" className="skip-link skip-to-content">
        Skip to main content
      </a>

      {/* Floating Inset Sidebar (16px margin from viewport edges, 24px radius, glass-2, padded 16px inside) */}
      <aside className={`sidebar glass-2 ${isRail ? 'rail' : ''}`} aria-label="Main Navigation">
        {/* Brand Block with Proper Padding (Never Flush to Edge) */}
        <div
          style={{
            padding: isRail ? '12px 0' : '16px',
            borderBottom: '1px solid var(--border)',
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
                  Academic Intelligence
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
              title="EduQuery"
            >
              EQ
            </div>
          )}
        </div>

        {/* 5 Canonical Nav Items */}
        <nav
          style={{
            flex: 1,
            padding: isRail ? '12px 6px' : '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
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
                gap: '12px',
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
              margin: '8px 4px',
              borderTop: '1px solid var(--border)',
            }}
          />

          {/* Secondary Action: Upload Marksheet */}
          <NavLink
            to="/upload"
            title={isRail ? 'Upload Marksheet' : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'flex-start',
              gap: '12px',
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

          {/* Design System link: Only in development builds */}
          {import.meta.env.DEV && (
            <NavLink
              to="/styleguide"
              title={isRail ? 'Design System' : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: isRail ? 'center' : 'flex-start',
                gap: '12px',
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
          )}
        </nav>

        {/* Sidebar Footer Block */}
        <div
          style={{
            padding: isRail ? '12px 6px' : '16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Dataset Status Line */}
          {!isRail && (
            <div style={{ fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                {studentCount} students &bull; {courseCount} courses
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                {datasetStatusLabel}
              </div>
            </div>
          )}

          {/* Theme Control and Collapse Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isRail ? 'center' : 'space-between',
              gap: '8px',
            }}
          >
            <ThemeMenu direction="up" align={isRail ? 'left' : 'right'} />
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
        {/* Sticky Glass-3 Top Bar with 1px Hairline */}
        <header className="top-bar">
          {/* Left: Page Title & Muted Desktop Subtitle */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 0,
              flex: 1,
              maxWidth: 'calc(100% - 110px)',
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

          {/* Right: (a) Search Field, (b) Single Theme Menu Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GlobalSearchTrigger onClick={() => setIsCommandPaletteOpen(true)} />
            <ThemeMenu align="right" direction="down" />
          </div>
        </header>

        {/* Page Content Body Region */}
        <main id="main-content-region" tabIndex={-1} className="page-body">
          {isColdStart ? (
            <BootScreen onDismiss={() => {}} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation (< 768px) */}
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {mainNavItems.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="bottom-nav-item"
            style={({ isActive }) => ({
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
            })}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/imports"
          className="bottom-nav-item"
          style={({ isActive }) => ({
            color: isActive ? 'var(--text)' : 'var(--text-muted)',
            fontWeight: isActive ? 700 : 500,
          })}
        >
          <Database size={18} />
          <span>Datasets</span>
        </NavLink>
      </nav>

      {/* Command Palette Modal */}
      <Suspense fallback={null}>
        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
          />
        )}
      </Suspense>
    </div>
  )
}
