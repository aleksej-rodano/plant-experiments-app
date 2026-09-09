import { supabase } from '../supabase'

const BUCKET = 'experiment-photos'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // raw pick limit; we compress before upload

const MAX_EDGE = 1600 // px, longest side after downscale
const JPEG_QUALITY = 0.82
const SKIP_IF_UNDER = 350 * 1024 // already small enough, upload as-is

export function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Use a JPG or PNG image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be 10MB or smaller.'
  return null
}

/**
 * Downscale to MAX_EDGE and re-encode as JPEG so a 3-12MB phone photo becomes
 * a few hundred KB. Falls back to the original file if the browser can't decode it.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (file.type === 'image/jpeg' && file.size <= SKIP_IF_UNDER) return file

  try {
    // `from-image` explicitly: the spec default changed to this, but an engine
    // still defaulting to `none` would upload a portrait phone photo rotated
    // 90 degrees. PhotoAnnotator already passes it, so without this the marked
    // and unmarked paths disagree about which way is up.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) return file
    return blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

const UPLOAD_TIMEOUT_MS = 30_000

export async function uploadImage(file: File, userId: string): Promise<string> {
  const blob = await compressImage(file)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  // The storage upload can't take an AbortSignal, so race it against a timeout
  // to fail loudly instead of hanging when the backend is slow to respond.
  const upload = supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' })

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Image upload timed out. Check your connection and try again.')),
      UPLOAD_TIMEOUT_MS,
    )
  })

  try {
    const { error } = await Promise.race([upload, timeout])
    if (error) throw error
  } finally {
    clearTimeout(timer)
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * The in-bucket path from a public URL, or null if the URL doesn't point at our
 * bucket (an external image, or a link left over from an earlier setup).
 */
export function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`
  const at = url.indexOf(marker)
  if (at === -1) return null
  const path = url.slice(at + marker.length).split('?')[0]
  return path ? decodeURIComponent(path) : null
}

/**
 * Delete uploaded images by public URL. Best effort: a failure here leaves an
 * orphaned file taking up space, which is not worth failing the caller over.
 *
 * Prefer `removeUnreferencedImages` unless you already know nothing else points
 * at these files -- see the note there.
 */
export async function removeStoredImages(urls: string[]): Promise<number> {
  const paths = [...new Set(urls)]
    .map(storagePathFromUrl)
    .filter((p): p is string => p !== null)
  if (paths.length === 0) return 0
  try {
    // `remove` reports a refusal in `error`, it does not throw. Discarding the
    // result made an RLS denial indistinguishable from success, which is how
    // the bucket went years without a delete policy while the app looked like
    // it was cleaning up after itself. Return the count so callers that care
    // can tell; the callers here still treat failure as tolerable.
    const { data, error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) return 0
    return data?.length ?? 0
  } catch {
    return 0
  }
}

/**
 * Every column that can hold a public URL from our bucket. Missing one here
 * means `removeUnreferencedImages` would happily delete a file that column
 * still points at — pest_guides especially, whose photos are shared reference
 * content that every account sees.
 */
const IMAGE_COLUMNS = [
  ['folders', 'cover_image_url'],
  ['experiments', 'cover_image_url'],
  ['date_logs', 'image_url'],
  ['notes', 'image_url'],
  ['pest_guides', 'image_url'],
  ['pest_guide_images', 'image_url'],
] as const

/**
 * Which of `urls` no row anywhere still points at.
 *
 * One upload can be shared: a folder-wide log entry writes the same public URL
 * onto one `date_logs` row per experiment in the folder, and replacing a photo
 * can leave the old URL in place on a row that was never saved.
 */
async function unreferencedUrls(urls: string[]): Promise<string[]> {
  const unique = [...new Set(urls)].filter(Boolean)
  if (unique.length === 0) return []

  const stillUsed = new Set<string>()
  const results = await Promise.all(
    IMAGE_COLUMNS.map(([table, column]) =>
      supabase.from(table).select(column).in(column, unique),
    ),
  )
  for (const { data, error } of results) {
    // A failed check has to count as "still referenced": deleting a file that
    // something might point at is the outcome worth avoiding here.
    if (error) return []
    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      for (const value of Object.values(row)) if (value) stillUsed.add(value)
    }
  }
  return unique.filter((u) => !stillUsed.has(u))
}

/**
 * Delete uploaded images, but only the ones nothing references any more.
 *
 * Call this *after* the rows that referenced them are gone. Best effort in both
 * directions: an image left behind only costs storage, whereas deleting one out
 * from under a surviving row shows the user a permanently broken photo.
 */
export async function removeUnreferencedImages(urls: string[]): Promise<number> {
  if (urls.length === 0) return 0
  try {
    return await removeStoredImages(await unreferencedUrls(urls))
  } catch {
    return 0
  }
}

/** A file in the bucket that nothing in the database points at. */
export interface OrphanedImage {
  path: string
  bytes: number
  createdAt: string
}

/**
 * Uploads that never made it onto a row, or were left behind before the bucket
 * had a delete policy (see db/2026-09-10_storage_policies.sql — until that ran,
 * every removal was silently denied by RLS).
 *
 * Two things keep this from eating live photos:
 *
 * - It compares against *every* row, binned ones included. A soft-deleted log
 *   entry still owns its photo and can be restored for 30 days.
 * - It ignores anything uploaded in the last `minAgeMs`. A photo is uploaded
 *   before the row that references it is inserted, so a file that is seconds
 *   old may simply belong to a form the user has not saved yet.
 */
export async function findOrphanedImages(
  userId: string,
  minAgeMs = 24 * 60 * 60 * 1000,
): Promise<OrphanedImage[]> {
  // Everything in this user's folder, paged.
  const files: { name: string; bytes: number; createdAt: string }[] = []
  const PAGE = 100
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, { limit: PAGE, offset })
    if (error) throw error
    const batch = data ?? []
    for (const f of batch) {
      files.push({
        name: `${userId}/${f.name}`,
        bytes: (f.metadata?.size as number | undefined) ?? 0,
        createdAt: f.created_at ?? new Date(0).toISOString(),
      })
    }
    if (batch.length < PAGE) break
  }
  if (files.length === 0) return []

  // Every path any row still points at, as in-bucket paths.
  const referenced = new Set<string>()
  const results = await Promise.all(
    IMAGE_COLUMNS.map(([table, column]) =>
      supabase.from(table).select(column).not(column, 'is', null),
    ),
  )
  for (const { data, error } of results) {
    // Same rule as unreferencedUrls: a check we could not complete means we do
    // not know what is referenced, so nothing is safe to call an orphan.
    if (error) throw error
    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      for (const value of Object.values(row)) {
        const path = value && storagePathFromUrl(value)
        if (path) referenced.add(path)
      }
    }
  }

  const cutoff = Date.now() - minAgeMs
  return files
    .filter((f) => !referenced.has(f.name))
    .filter((f) => new Date(f.createdAt).getTime() < cutoff)
    .map((f) => ({ path: f.name, bytes: f.bytes, createdAt: f.createdAt }))
}

/** Delete the given in-bucket paths. Returns how many the API reported gone. */
export async function deleteStoredPaths(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
  return data?.length ?? 0
}

/** Human-readable byte size for the maintenance readout. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
