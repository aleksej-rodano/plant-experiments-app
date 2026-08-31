import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Top-level destinations: from any of these the back button leaves for the
// Experiments home; pressing it again on Experiments exits the app.
const ROOT_ROUTES = new Set([
  '/experiments',
  '/stats',
  '/fertilizer-log',
  '/pest-control',
  '/tips',
  '/notes',
  '/settings',
  '/bin',
])

const HOME = '/experiments'

/**
 * Make the Android hardware back button navigate within the app instead of
 * closing it on the first press. Deep screens go back one step; the top-level
 * tabs fall back to Experiments; Experiments itself exits. No-op off-device.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return

    let remove: (() => void) | undefined
    void import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('backButton', () => {
        const path = location.pathname
        if (!ROOT_ROUTES.has(path)) {
          navigate(-1)
        } else if (path !== HOME) {
          navigate(HOME)
        } else {
          void App.exitApp()
        }
      })
      remove = () => {
        void handle.then((h) => h.remove())
      }
    })

    return () => remove?.()
  }, [navigate, location.pathname])
}
