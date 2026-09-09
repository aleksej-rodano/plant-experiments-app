import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    env: {
      // The date helpers read the local calendar on purpose. Pinning a zone well
      // away from UTC is what makes a regression back to toISOString() visible:
      // in UTC the two agree and the test would pass either way.
      TZ: 'Pacific/Auckland',
      // src/lib/supabase.ts throws at import time without these. No request is
      // ever made — the tests only reach the pure helpers next to it.
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
