import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local.',
  )
}

/**
 * On Android the WebView's `localStorage` is not a safe place to keep the auth
 * token — the OS can evict DOM storage when the app process is killed, which
 * logged the user out on almost every cold start. `@capacitor/preferences` is
 * backed by native `SharedPreferences`, so the session survives until an
 * explicit sign-out. Web keeps using `localStorage` (the default) so the
 * optimistic session read in AuthProvider stays synchronous.
 */
const nativeSessionStorage = {
  getItem: (key: string) =>
    Preferences.get({ key }).then(({ value }) => value ?? null),
  setItem: (key: string, value: string) =>
    Preferences.set({ key, value }).then(() => undefined),
  removeItem: (key: string) => Preferences.remove({ key }).then(() => undefined),
}

const isNative = Capacitor.isNativePlatform()

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative,
    ...(isNative ? { storage: nativeSessionStorage } : {}),
  },
})
