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
export async function removeStoredImages(urls: string[]): Promise<void> {
  const paths = [...new Set(urls)]
    .map(storagePathFromUrl)
    .filter((p): p is string => p !== null)
  if (paths.length === 0) return
  try {
    await supabase.storage.from(BUCKET).remove(paths)
  } catch {
    // ignored on purpose
  }
}

/** Every column that can hold a public URL from our bucket. */
const IMAGE_COLUMNS = [
  ['folders', 'cover_image_url'],
  ['experiments', 'cover_image_url'],
  ['date_logs', 'image_url'],
  ['notes', 'image_url'],
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
export async function removeUnreferencedImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  try {
    await removeStoredImages(await unreferencedUrls(urls))
  } catch {
    // ignored on purpose
  }
}
