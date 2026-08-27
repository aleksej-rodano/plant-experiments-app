import { Loader2, LogOut, Sprout } from 'lucide-react'
import LoginPage from './pages/LoginPage'
import { useAuth } from './lib/hooks/useAuth'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (!user) return <LoginPage />

  // Placeholder dashboard — real routing and views land in Task 1+.
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-on-primary-container">
        <Sprout className="size-6" />
        <span className="text-lg font-medium">Signed in as {user.email}</span>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-on-primary"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </main>
  )
}

export default App
