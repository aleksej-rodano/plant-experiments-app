import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from './auth-context'
import { supabase } from './supabase'

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

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return
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
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
