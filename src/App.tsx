import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/hooks/useAuth'
import CreateExperimentPage from './pages/CreateExperimentPage'
import ExperimentDetailPage from './pages/ExperimentDetailPage'
import ExperimentsPage from './pages/ExperimentsPage'
import LoginPage from './pages/LoginPage'
import PestControlPage from './pages/PestControlPage'
import TipsPage from './pages/TipsPage'

function FullScreenLoader() {
  return (
    <main className="flex min-h-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </main>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function App() {
  const { user, loading } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            loading ? (
              <FullScreenLoader />
            ) : user ? (
              <Navigate to="/experiments" replace />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/experiments" element={<ExperimentsPage />} />
            <Route path="/experiments/new" element={<CreateExperimentPage />} />
            <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
            <Route path="/pest-control" element={<PestControlPage />} />
            <Route path="/tips" element={<TipsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/experiments" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
