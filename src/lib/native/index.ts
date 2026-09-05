import { Capacitor } from '@capacitor/core'

export {
  syncCareNotifications,
  useCareNotificationsSync,
} from './notifications'

/**
 * True when running inside the Capacitor native shell (the Android app), false on
 * the hosted web app / `npm run dev`. Used to hide web-only features (PDF/CSV
 * export) from the phone build.
 */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

/**
 * Native-only startup: colour the status bar to match the app header and drop the
 * splash screen once the web layer is up. A no-op in the browser so the same
 * bundle still runs on the hosted web app.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark }) // light icons on the dark green bar
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#1b5e20' })
      // Keep the web layer below the status bar on Android versions that still
      // honour this; newer ones force edge-to-edge and the CSS safe-area
      // padding in index.css takes over instead.
      await StatusBar.setOverlaysWebView({ overlay: false })
    }
  } catch {
    // Status bar plugin missing or unavailable — not worth failing startup over.
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // ignored on purpose
  }
}
