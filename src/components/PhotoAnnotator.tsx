import { Check, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  /** The freshly picked / taken photo to mark up. */
  file: File
  /** Close without changing the photo. */
  onCancel: () => void
  /** Hand back a new JPEG File with the red circle burned in. */
  onDone: (marked: File) => void
}

const RED = '#ff1744'
const MIN_DIAM = 0.06 // fraction of the image width
const MAX_DIAM = 0.95

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Full-screen overlay: drag a red ring around the photo, size it with the
 * slider, then "Save mark" bakes it into a new JPEG at full resolution. The
 * caller swaps that File in for the original, so it flows through the normal
 * compress + upload path untouched.
 */
export default function PhotoAnnotator({ file, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 })
  const [diam, setDiam] = useState(0.3) // fraction of the image width
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [saving, setSaving] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (el) setBox({ w: el.clientWidth, h: el.clientHeight })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  function pointTo(e: React.PointerEvent) {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCenter({
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    })
  }

  async function save() {
    setSaving(true)
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const w = bmp.width
      const h = bmp.height
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        bmp.close()
        onCancel()
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bmp, 0, 0)
      bmp.close()

      ctx.strokeStyle = RED
      ctx.lineWidth = Math.max(3, Math.round(w * 0.006))
      ctx.beginPath()
      ctx.arc(center.x * w, center.y * h, (diam * w) / 2, 0, Math.PI * 2)
      ctx.stroke()

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.92),
      )
      if (!blob) {
        onCancel()
        return
      }
      const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
      onDone(new File([blob], `${base}-marked.jpg`, { type: 'image/jpeg' }))
    } catch {
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  const dPx = diam * box.w

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Circle the spot</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded-lg p-1.5 hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
        <div
          ref={wrapRef}
          className="relative touch-none select-none"
          onPointerDown={(e) => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            pointTo(e)
          }}
          onPointerMove={(e) => {
            if (dragging.current) pointTo(e)
          }}
          onPointerUp={(e) => {
            dragging.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        >
          {src && (
            <img
              src={src}
              alt="Photo to mark"
              draggable={false}
              onLoad={measure}
              className="block max-h-[70vh] max-w-full object-contain"
            />
          )}
          {box.w > 0 && (
            <div
              className="pointer-events-none absolute rounded-full border-[3px]"
              style={{
                width: dPx,
                height: dPx,
                left: center.x * box.w - dPx / 2,
                top: center.y * box.h - dPx / 2,
                borderColor: RED,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.35)',
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-surface px-4 py-4">
        <label className="flex items-center gap-3 text-sm text-on-surface-variant">
          Size
          <input
            type="range"
            min={MIN_DIAM * 100}
            max={MAX_DIAM * 100}
            value={Math.round(diam * 100)}
            onChange={(e) => setDiam(Number(e.target.value) / 100)}
            className="flex-1 accent-error"
          />
        </label>
        <p className="text-center text-xs text-on-surface-variant">
          Drag on the photo to move the circle.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {saving ? 'Saving…' : 'Save mark'}
          </button>
        </div>
      </div>
    </div>
  )
}
