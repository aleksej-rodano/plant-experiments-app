import { Bug, Droplets, Lightbulb, LogOut, NotebookPen, Sprout } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'

const NAV = [
  { to: '/experiments', label: 'Experiments', icon: Sprout },
  { to: '/fertilizer-log', label: 'Fertilizer Log', icon: Droplets },
  { to: '/pest-control', label: 'Pest Control', icon: Bug },
  { to: '/tips', label: 'Tips', icon: Lightbulb },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
]

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

  return (
    <div className="flex min-h-full flex-col bg-background text-on-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-on-primary shadow-sm">
        <div className="flex items-center gap-2">
          <Sprout className="size-6" />
          <span className="text-lg font-medium">Plant Experiments</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title={user?.email ?? 'Sign out'}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-on-primary/10"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1">
        {/* Desktop navigation rail */}
        <nav
          aria-label="Primary"
          className="hidden w-56 shrink-0 flex-col gap-1 border-r border-outline-variant p-3 md:flex"
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-4 pb-24 md:pb-4">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-outline-variant bg-surface md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
                  <Icon className="size-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
