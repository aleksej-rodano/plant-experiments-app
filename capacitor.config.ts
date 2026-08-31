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
    // No Keyboard config: on Android the plugin ignores `resize` entirely (it
    // never calls setSoftInputMode, and setResizeMode is unimplemented) — that
    // option is iOS-only. What decides the behaviour is
    // android:windowSoftInputMode="adjustResize" on the activity in
    // AndroidManifest.xml. Don't re-add `resize` here expecting an effect.
  },
}

export default config
