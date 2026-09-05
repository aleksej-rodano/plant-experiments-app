import { Loader2, Sprout } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

/**
 * Landing page for the "forgot password" email link. Supabase turns the link
 * into a short-lived recovery session; here the user picks a new password.
 */
export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      navigate('/experiments', {
        replace: true,
        state: { toast: 'Password updated. You are signed in.' },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update the password.',
      )
      setBusy(false)
    }
  }

  const linkDead = !loading && !session

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-md ring-1 ring-outline-variant">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <Sprout className="size-7" />
          <h1 className="text-xl font-medium text-on-surface">
            Set a new password
          </h1>
        </div>

        {linkDead ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
              This reset link is invalid or has expired. Request a new one from
              the sign-in screen.
            </p>
            <Link
              to="/login"
              className="rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-on-primary hover:opacity-90"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              New password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Confirm new password
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </label>

            {error && (
              <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save new password
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
