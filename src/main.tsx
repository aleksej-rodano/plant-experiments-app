import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './lib/AuthProvider.tsx'
import { initNative, isNativeApp } from './lib/native'

void initNative()

// PWA service worker — web only. The Capacitor shell loads the same deployed
// site (server.url) but must always show the freshest build, so it never gets a
// SW in the way.
if (!isNativeApp()) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
