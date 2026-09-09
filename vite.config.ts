import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // New service worker takes over and refreshes open tabs on the next load —
      // no update prompt. The SW is registered manually in main.tsx and only on
      // the web (never inside the Capacitor shell).
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Plant Experiments',
        short_name: 'Plant Exp',
        description:
          'Track plant propagation experiments — per-experiment stage counts, photos, and survival.',
        theme_color: '#1b5e20',
        background_color: '#1b5e20',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/experiments',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the content-hashed build output only — filenames change every
        // build, so there's no stale-cache risk. Nothing from Supabase is
        // cached: data is always fetched live.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  define: {
    // Stamped at build time so the running app can show which build it is —
    // handy for confirming a phone reinstall actually took.
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' '),
    ),
  },
})
