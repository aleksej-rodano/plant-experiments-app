import { supabase } from '../supabase'

const BUCKET = 'experiment-photos'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Use a JPG or PNG image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be 5MB or smaller.'
  return null
}

export async function uploadImage(file: File, userId: string): Promise<string> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
