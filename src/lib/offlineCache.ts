// Cache names must match the `cacheName`s in the `runtimeCaching` config in
// vite.config.ts.
const SUPABASE_CACHE_NAMES = ['supabase-data', 'supabase-images']

/**
 * The service worker's runtime cache is keyed by URL only, not by auth
 * header, so a second account signing in on the same device could otherwise
 * see the previous account's cached rows and photos while offline. Wipe the
 * Supabase caches on sign-out to close that gap.
 */
export async function clearOfflineDataCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  await Promise.all(
    SUPABASE_CACHE_NAMES.map((name) => caches.delete(name).catch(() => false)),
  )
}
