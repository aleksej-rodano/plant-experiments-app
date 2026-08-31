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
      // Let Android resize the WebView itself when the keyboard opens — avoids
      // the black gap that "body"/"none" leave on some devices.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
}

export default config
