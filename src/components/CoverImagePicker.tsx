import { Camera, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** A newly picked file, or null when nothing new has been chosen. */
  image: File | null
  /** Called with the chosen file (or undefined if the picker was dismissed). */
  onPick: (file: File | undefined) => void
  /** Clear both the new pick and any stored image. */
  onClear: () => void
  /** The already-stored image URL (edit forms) shown when no new file is picked. */
  existingUrl?: string
  /** Field caption, e.g. "Cover image" / "Initial photo". */
  label: string
  /** Validation message to show under the field. */
  error?: string
}

/**
 * Cover / initial photo field with BOTH a camera capture and a file/gallery
 * pick, matching the two-input pattern already used in the date-log form. The
 * `capture` input opens the camera directly on Android; on the desktop web app
 * it falls back to a normal file dialog, so the same markup works everywhere.
 */
export default function CoverImagePicker({
  image,
  onPick,
  onClear,
  existingUrl,
  label,
  error,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!image) {
      setNewPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(image)
    setNewPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  function handleClear() {
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
    onClear()
  }

  const previewSrc = newPreviewUrl ?? (existingUrl || null)

  return (
    <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
      {label}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onPick(e.target.files?.[0])}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => onPick(e.target.files?.[0])}
        className="hidden"
      />
      {previewSrc ? (
        <div className="relative overflow-hidden rounded-lg ring-1 ring-outline-variant">
          <img
            src={previewSrc}
            alt={`${label} preview`}
            className="aspect-video w-full object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant"
          >
            <Camera className="size-5" />
            Take photo
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant"
          >
            <ImagePlus className="size-5" />
            Choose from device
          </button>
        </div>
      )}
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
