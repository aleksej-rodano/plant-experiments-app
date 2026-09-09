import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from './auth-context'
import { isNativeApp } from './native'
import { clearOfflineDataCaches } from './offlineCache'
import { supabase } from './supabase'

// The hosted web app handles the reset link even when the request came from the
// phone, so point the email there rather than at capacitor://localhost.
const WEB_APP_ORIGIN = 'https://plant-experiments-app.vercel.app'

function resetRedirectUrl(): string {
  const origin =
    !isNativeApp() && typeof window !== 'undefined'
      ? window.location.origin
      : WEB_APP_ORIGIN
  return `${origin}/reset-password`
}

/**
 * Read the persisted Supabase session straight out of localStorage so returning
 * users render the app immediately, without waiting for `getSession()` — which
 * blocks on a network token refresh when the stored access token has expired.
 * The async listeners below correct this value once auth has really settled.
 */
function readStoredSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const session = parsed?.access_token ? parsed : (parsed?.currentSession ?? null)
      return session?.access_token ? (session as Session) : null
    }
  } catch {
    // Corrupt/blocked storage — fall through to the normal async path.
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readStoredSession())
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (cancelled) return
      // A reset link opens the app with a short-lived session; hold the UI on
      // the "set a new password" screen until the user picks one.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
      setLoading(false)
    })

    // Safety net: never trap the UI behind a slow token refresh. After this we
    // trust the optimistically-read stored session; the calls above still
    // correct it when they resolve.
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 3000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        return { needsEmailConfirmation: data.session === null }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        await clearOfflineDataCaches()
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: resetRedirectUrl(),
        })
        if (error) throw error
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setRecovering(false)
      },
      recovering,
    }),
    [session, loading, recovering],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
