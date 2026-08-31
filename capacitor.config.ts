import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.experiments.planttracker',
  appName: 'Plant Experiments',
  webDir: 'dist',
  // White behind the web layer so a keyboard-driven resize never flashes black.
  backgroundColor: '#ffffff',
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // initNative() hides it once React has mounted
      backgroundColor: '#1b5e20',
      androidSplashResourceName: 'splash',
    },
    Keyboard: {
      // Don't resize the web view at all — "native" left a large blank gap
      // between the form and the keyboard on the S9+. With "none" the keyboard
      // just overlays the web view and Android scrolls the focused field into
      // view; the bottom nav (behind the keyboard) is hidden via useKeyboardOpen.
      resize: 'none',
    },
  },
}

export default config
