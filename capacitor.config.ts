import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.experiments.planttracker',
  appName: 'Plant Experiments',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // initNative() hides it once React has mounted
      backgroundColor: '#1b5e20',
      androidSplashResourceName: 'splash',
    },
  },
}

export default config
