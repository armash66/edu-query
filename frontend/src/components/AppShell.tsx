import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Compass,
  Users,
  BookOpen,
  ShieldCheck,
  UploadCloud,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  Trash2,
} from 'lucide-react'
import { useHealth } from '../context/HealthContext'
import { useSession } from '../context/SessionContext'
import { ConfirmDialog } from './ConfirmDialog'

export const AppShell: React.FC = () => {
  const { health, loading: healthLoading, refreshHealth } = useHealth()
  const { session, hasActiveSession, deleteSession } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Determine current page title
  const getPageTitle = (pathname: string): string => {
    if (pathname === '/upload') return 'Analyze a Marksheet'
    if (pathname === '/') {
      return hasActiveSession ? 'Academic Analysis Overview' : 'Analyze a Marksheet'
    }
    if (pathname === '/explore') return 'Explore Academic Data'
    if (pathname.startsWith('/students/')) return 'Student Performance Breakdown'
    if (pathname.startsWith('/subjects/') && pathname.includes('/failures')) return 'Subject Student Roster'
    if (pathname.startsWith('/subjects/')) return 'Subject Student Evaluation Roster'
    if (pathname === '/failures') return 'Subject Failures Analysis'
    if (pathname === '/subjects') return 'Curriculum & Course Performance'
    if (pathname === '/data-quality') return 'Data Quality & Anomaly Audit'
    if (pathname === '/imports') return 'Dataset Management & Imports'
    return 'EduQuery Faculty Portal'
  }

  const handleDeleteSessionConfirm = async () => {
    setDeleting(true)
    try {
      await deleteSession()
      await refreshHealth()
      setIsDeleteDialogOpen(false)
      navigate('/upload')
    } catch {
      // Non-blocking
    } finally {
      setDeleting(false)
    }
  }

  const isTemporary = session?.mode === 'temporary' || (!session?.mode && hasActiveSession)

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-badge">FACULTY ANALYSIS</div>
          <div className="brand-title">
            <Database size={20} style={{ color: '#0284c7' }} />
            <span>EduQuery</span>
          </div>
          <div className="brand-subtitle">Privacy-First Academic Analysis</div>
        </div>

        <nav className="sidebar-nav" aria-label="Main Navigation">
          {hasActiveSession ? (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <BarChart3 size={18} />
                <span>Overview</span>
              </NavLink>

              <NavLink
                to="/students"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Users size={18} />
                <span>Students</span>
              </NavLink>

              <NavLink
                to="/subjects"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <BookOpen size={18} />
                <span>Subjects</span>
              </NavLink>

              <NavLink
                to="/explore"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Compass size={18} />
                <span>Explore</span>
              </NavLink>

              <NavLink
                to="/data-quality"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <ShieldCheck size={18} />
                <span>Data Issues</span>
              </NavLink>

              <div style={{ margin: '0.75rem 0.5rem 0.25rem', borderTop: '1px solid #e2e8f0' }} />

              <NavLink
                to="/upload"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <UploadCloud size={18} />
                <span>Upload New</span>
              </NavLink>
            </>
          ) : (
            <NavLink
              to="/upload"
              className="nav-item active"
              onClick={() => setSidebarOpen(false)}
            >
              <UploadCloud size={18} />
              <span>Upload Marksheet</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Session Status
              </span>
              {hasActiveSession ? (
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}>
                  <CheckCircle2 size={12} /> {session?.mode === 'persistent' ? 'Persistent' : 'Temporary'}
                </span>
              ) : (
                <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                  <AlertCircle size={12} /> No Session
                </span>
              )}
            </div>

            {hasActiveSession && (
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                <div>Students: <strong>{session?.students_count ?? health?.database?.students_count ?? 0}</strong></div>
                <div>Courses: <strong>{session?.courses_count ?? health?.database?.courses_count ?? 0}</strong></div>
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
              EduQuery &bull; Privacy-First Architecture
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="btn btn-secondary btn-icon mobile-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation menu"
              style={{ display: 'none' }}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="page-title">{getPageTitle(location.pathname)}</h1>
          </div>

          <div className="top-bar-right">
            {/* System / Dataset Health Pill */}
            {healthLoading ? (
              <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="spinner" style={{ width: '0.75rem', height: '0.75rem' }} /> Checking status...
              </span>
            ) : hasActiveSession ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }} />
                {session?.mode === 'persistent' ? 'Saved Dataset' : 'Temporary Session Active'}
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  fontWeight: 500,
                }}
              >
                No Active Analysis
              </span>
            )}

            {/* Refresh Health */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => refreshHealth()}
              title="Refresh connection status"
              aria-label="Refresh status"
            >
              <RefreshCw size={14} className={healthLoading ? 'spin-icon' : ''} />
            </button>

            {/* Delete Session and Data Button (Prominent but restrained) */}
            {hasActiveSession && isTemporary && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                title="Erase all temporary records and reset session"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#991b1b',
                  borderColor: '#fca5a5',
                  backgroundColor: '#fff5f5',
                }}
              >
                <Trash2 size={14} />
                <span>Delete session and data</span>
              </button>
            )}
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>

      {/* Confirmation Dialog for Session Deletion */}
      {isDeleteDialogOpen && (
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
      )}
    </div>
  )
}
