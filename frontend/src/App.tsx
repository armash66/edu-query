import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './ui/Toast'
import { HealthProvider } from './context/HealthContext'
import { AdminKeyProvider } from './context/AdminKeyContext'
import { SessionProvider, useSession } from './context/SessionContext'
import { AppShell } from './components/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { StudentsPage } from './pages/StudentsPage'
import { StudentDetailPage } from './pages/StudentDetailPage'
import { SubjectDetailPage } from './pages/SubjectDetailPage'
import { SubjectsCatalogPage } from './pages/SubjectsCatalogPage'
import { DataQualityPage } from './pages/DataQualityPage'
import { ImportPage } from './pages/ImportPage'
import { UploadPage } from './pages/UploadPage'
import { StyleguidePage } from './pages/StyleguidePage'
import { LoadingState } from './components/LoadingState'

function HomeRoute() {
  const { hasActiveSession, loading } = useSession()
  if (loading) {
    return <LoadingState message="Checking session status..." />
  }
  if (!hasActiveSession) {
    return <UploadPage />
  }
  return <OverviewPage />
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AdminKeyProvider>
          <HealthProvider>
            <SessionProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<HomeRoute />} />
                    <Route path="/upload" element={<UploadPage />} />
                    <Route path="/students" element={<StudentsPage />} />
                    <Route path="/students/:identifier" element={<StudentDetailPage />} />
                    <Route path="/explore" element={<Navigate to="/students?preset=explore" replace />} />
                    <Route path="/absent-students" element={<Navigate to="/students?preset=absent" replace />} />
                    <Route path="/subjects" element={<SubjectsCatalogPage />} />
                    <Route path="/subjects/:courseCode" element={<SubjectDetailPage />} />
                    <Route path="/subjects/:courseCode/failures" element={<SubjectDetailPage />} />
                    <Route path="/failures" element={<Navigate to="/subjects?tab=failures" replace />} />
                    <Route path="/data-quality" element={<DataQualityPage />} />
                    <Route path="/imports" element={<ImportPage />} />
                    <Route path="/styleguide" element={<StyleguidePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </SessionProvider>
          </HealthProvider>
        </AdminKeyProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
