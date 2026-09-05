import { Loader2, Sprout } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/hooks/useAuth'

type Mode = 'signin' | 'signup' | 'reset'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function LoginPage() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'reset') {
        await sendPasswordReset(email)
        setNotice(
          'If an account exists for that email, a reset link is on its way. Check your inbox.',
        )
        setMode('signin')
      } else {
        const { needsEmailConfirmation } = await signUp(email, password)
        if (needsEmailConfirmation) {
          setNotice('Account created. Check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitLabel =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'reset'
        ? 'Email me a reset link'
        : 'Create account'

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-md ring-1 ring-outline-variant">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <Sprout className="size-7" />
          <h1 className="text-xl font-medium text-on-surface">
            {mode === 'reset' ? 'Reset your password' : 'Plant Experiments'}
          </h1>
        </div>

        {mode === 'reset' && (
          <p className="mb-4 text-sm text-on-surface-variant">
            Enter the email you sign in with and we'll send a link to set a new
            password.
          </p>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>

          {mode !== 'reset' && (
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Password
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => switchMode('reset')}
              className="-mt-1 self-start text-sm text-primary hover:underline"
            >
              Forgot your password?
            </button>
          )}

          {error && (
            <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-on-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </button>
        </form>

        {mode === 'reset' ? (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="mt-4 w-full text-center text-sm text-primary hover:underline"
          >
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-center text-sm text-primary hover:underline"
          >
            {mode === 'signin'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-on-surface-variant/70">
        Build {__BUILD_TIME__}
      </p>
    </main>
  )
}
