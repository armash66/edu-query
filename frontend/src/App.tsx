import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './ui/Toast'
import { HealthProvider } from './context/HealthContext'
import { AdminKeyProvider } from './context/AdminKeyContext'
import { SessionProvider, useSession } from './context/SessionContext'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/LoadingState'

const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage })))
const StudentsPage = lazy(() => import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })))
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })))
const AbsentStudentsPage = lazy(() => import('./pages/AbsentStudentsPage').then((m) => ({ default: m.AbsentStudentsPage })))
const SubjectFailuresPage = lazy(() => import('./pages/SubjectFailuresPage').then((m) => ({ default: m.SubjectFailuresPage })))
const SubjectDetailPage = lazy(() => import('./pages/SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage })))
const SubjectsCatalogPage = lazy(() => import('./pages/SubjectsCatalogPage').then((m) => ({ default: m.SubjectsCatalogPage })))
const DataQualityPage = lazy(() => import('./pages/DataQualityPage').then((m) => ({ default: m.DataQualityPage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })))
const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })))
const StyleguidePage = lazy(() => import('./pages/StyleguidePage').then((m) => ({ default: m.StyleguidePage })))

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
                <Suspense fallback={<LoadingState message="Loading workspace view..." />}>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<HomeRoute />} />
                      <Route path="/upload" element={<UploadPage />} />
                      <Route path="/explore" element={<ExplorePage />} />
                      <Route path="/students" element={<StudentsPage />} />
                      <Route path="/students/:identifier" element={<StudentDetailPage />} />
                      <Route path="/absent-students" element={<AbsentStudentsPage />} />
                      <Route path="/absent" element={<AbsentStudentsPage />} />
                      <Route path="/subjects" element={<SubjectsCatalogPage />} />
                      <Route path="/subjects/:courseCode" element={<SubjectDetailPage />} />
                      <Route path="/subjects/:courseCode/failures" element={<SubjectDetailPage />} />
                      <Route path="/failures" element={<SubjectFailuresPage />} />
                      <Route path="/data-quality" element={<DataQualityPage />} />
                      <Route path="/quality" element={<DataQualityPage />} />
                      <Route path="/imports" element={<ImportPage />} />
                      <Route path="/styleguide" element={<StyleguidePage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </SessionProvider>
          </HealthProvider>
        </AdminKeyProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
