import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/hooks/useAuth'
import { useAndroidBackButton } from './lib/native/useAndroidBackButton'
import AddDateLogPage from './pages/AddDateLogPage'
import AddFolderDateLogPage from './pages/AddFolderDateLogPage'
import BinPage from './pages/BinPage'
import CreateExperimentPage from './pages/CreateExperimentPage'
import CreateFolderPage from './pages/CreateFolderPage'
import EditDateLogPage from './pages/EditDateLogPage'
import EditExperimentPage from './pages/EditExperimentPage'
import EditFolderPage from './pages/EditFolderPage'
import ExperimentDetailPage from './pages/ExperimentDetailPage'
import FertilizerLogPage from './pages/FertilizerLogPage'
import FolderDetailPage from './pages/FolderDetailPage'
import FoldersPage from './pages/FoldersPage'
import LoginPage from './pages/LoginPage'
import NotesPage from './pages/NotesPage'
import PestControlPage from './pages/PestControlPage'
import QuickPhotoLogPage from './pages/QuickPhotoLogPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'
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
  // If we already have a (possibly optimistic) session, render straight away —
  // only block on the loader while we still don't know whether anyone is signed in.
  if (loading && !user) return <FullScreenLoader />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RouterEffects() {
  useAndroidBackButton()
  return null
}

function App() {
  const { user, loading } = useAuth()

  return (
    <BrowserRouter>
      <RouterEffects />
      <Routes>
        <Route
          path="/login"
          element={
            loading && !user ? (
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
            <Route path="/experiments" element={<FoldersPage />} />
            <Route path="/folders/new" element={<CreateFolderPage />} />
            <Route path="/folders/:folderId" element={<FolderDetailPage />} />
            <Route
              path="/folders/:folderId/edit"
              element={<EditFolderPage />}
            />
            <Route
              path="/folders/:folderId/experiments/new"
              element={<CreateExperimentPage />}
            />
            <Route
              path="/folders/:folderId/logs/new"
              element={<AddFolderDateLogPage />}
            />
            <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
            <Route
              path="/experiments/:id/edit"
              element={<EditExperimentPage />}
            />
            <Route
              path="/experiments/:id/logs/new"
              element={<AddDateLogPage />}
            />
            <Route
              path="/experiments/:id/logs/photo"
              element={<QuickPhotoLogPage />}
            />
            <Route
              path="/experiments/:id/logs/:logId/edit"
              element={<EditDateLogPage />}
            />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/bin" element={<BinPage />} />
            <Route path="/fertilizer-log" element={<FertilizerLogPage />} />
            <Route path="/pest-control" element={<PestControlPage />} />
            <Route path="/tips" element={<TipsPage />} />
            <Route path="/notes" element={<NotesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/experiments" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
