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
      // Android resizes the window when the keyboard opens; the Layout is a
      // fixed-height flex column whose <main> is the only scroller, so it
      // shrinks cleanly and scrolls the focused field into view — no dead gap.
      resize: 'native',
    },
  },
}

export default config
