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
    const bitmap = await createImageBitmap(file)
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

export async function uploadImage(file: File, userId: string): Promise<string> {
  const blob = await compressImage(file)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
