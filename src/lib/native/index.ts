import { Capacitor } from '@capacitor/core'

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
