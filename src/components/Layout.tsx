import {
  BarChart3,
  Bug,
  Droplets,
  Lightbulb,
  LogOut,
  NotebookPen,
  Settings,
  Sprout,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { useKeyboardState } from '../lib/native/useKeyboardState'
import { purgeExpired } from '../lib/utils/bin'

// Module scope, not a ref: the sweep should run once per page load, not once per
// mount (React StrictMode mounts twice in development).
let sweptThisSession = false

// `label` shows in the desktop rail; `short` (when set) shows in the cramped
// mobile bottom bar.
const NAV = [
  { to: '/experiments', label: 'Experiments', short: 'Exp.', icon: Sprout },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/fertilizer-log', label: 'Fertilizer Log', short: 'Feeding', icon: Droplets },
  { to: '/pest-control', label: 'Pest Control', short: 'Pests', icon: Bug },
  { to: '/tips', label: 'Tips', icon: Lightbulb },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
] as const

function navItemClass(isActive: boolean) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary-container text-on-primary-container'
      : 'text-on-surface-variant hover:bg-surface-variant',
  ].join(' ')
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const { open: keyboardOpen, inset: keyboardInset } = useKeyboardState()

  // Clear out anything past its 30-day restore window, photos included. Silent
  // by design: it's housekeeping, and a failure just means it retries next load.
  useEffect(() => {
    if (!user || sweptThisSession) return
    sweptThisSession = true
    void purgeExpired().catch(() => {
      sweptThisSession = false
    })
  }, [user])

  return (
    // Fixed to the viewport; <main> is the only thing that scrolls. Normally
    // Android shrinks the window for the soft keyboard (adjustResize) and the
    // 100% height follows it; `keyboardInset` is the fallback for shells that
    // pan the window instead and would otherwise leave a dead gap above the
    // keyboard. See useKeyboardState.
    <div
      className="flex h-full flex-col overflow-hidden bg-background text-on-background"
      style={keyboardInset ? { height: `calc(100% - ${keyboardInset}px)` } : undefined}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 bg-primary px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-on-primary shadow-sm">
        <div className="flex items-center gap-2">
          <Sprout className="size-6" />
          <span className="text-lg font-medium">Plant Experiments</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              [
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-on-primary/10',
                isActive ? 'bg-on-primary/10' : '',
              ].join(' ')
            }
          >
            <Settings className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </NavLink>
          <button
            type="button"
            onClick={() => void signOut()}
            title={user?.email ?? 'Sign out'}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-on-primary/10"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 overflow-hidden">
        {/* Desktop navigation rail */}
        <nav
          aria-label="Primary"
          className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-outline-variant p-3 md:flex"
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation — a normal flex child (not fixed), dropped
          entirely while the soft keyboard is up. */}
      {!keyboardOpen && (
        <nav
          aria-label="Primary"
          className="flex shrink-0 border-t border-outline-variant bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium',
                isActive ? 'text-primary' : 'text-on-surface-variant',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex h-8 w-16 items-center justify-center rounded-lg',
                    isActive ? 'bg-primary-container text-on-primary-container' : '',
                  ].join(' ')}
                >
                  <item.icon className="size-5" />
                </span>
                {'short' in item ? item.short : item.label}
              </>
            )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
