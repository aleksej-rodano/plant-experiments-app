import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { consumeBack } from './backInterceptor'

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

    // The effect re-runs on every navigation, but the listener is registered
    // after an await. Without this flag a cleanup that lands during that gap —
    // the first load, where the chunk is still being fetched, or StrictMode's
    // double mount — would find nothing to remove, and the listener would
    // register anyway and outlive its effect. Stacked listeners make one back
    // press navigate twice, or exit the app from under an open overlay.
    let disposed = false
    let remove: (() => void) | undefined

    void import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('backButton', () => {
        // Let an open overlay (e.g. the photo viewer) swallow the press first.
        if (consumeBack()) return
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
      if (disposed) remove()
    })

    return () => {
      disposed = true
      remove?.()
    }
  }, [navigate, location.pathname])
}
