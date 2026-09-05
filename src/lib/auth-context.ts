import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  /** Email the user a password-reset link (lands on /reset-password). */
  sendPasswordReset: (email: string) => Promise<void>
  /** Set a new password for the currently-recovering session. */
  updatePassword: (password: string) => Promise<void>
  /** True after a password-recovery link has opened the app. */
  recovering: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
