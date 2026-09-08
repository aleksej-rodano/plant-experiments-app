import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { pushBackInterceptor } from '../lib/native/backInterceptor'

interface Props {
  src: string
  alt?: string
  /** Close the viewer. */
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 6
const DOUBLE_TAP_MS = 300
const TAP_SLOP = 10 // px of movement still counted as a tap

interface Transform {
  scale: number
  x: number
  y: number
}

/**
 * Full-screen photo viewer. Tap to open it from a thumbnail; then:
 *  - pinch (touch) or scroll-wheel (desktop) to zoom toward that point
 *  - double-tap / double-click to toggle between fit and 3×
 *  - drag to pan once zoomed in
 *  - tap the backdrop, press Esc, or use the back button to close
 */
export default function ImageLightbox({ src, alt = '', onClose }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [t, setT] = useState<Transform>({ scale: 1, x: 0, y: 0 })

  const tRef = useRef(t)
  tRef.current = t
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef<number | null>(null)
  const panFrom = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)
  const downAt = useRef(0)
  const lastTapAt = useRef(0)

  // Keep the latest onClose without re-running the wiring effect.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Esc closes; the Android hardware back button closes the viewer instead of
  // navigating the page away; body scroll is locked while open.
  useEffect(() => {
    const close = () => onCloseRef.current()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const removeBack = pushBackInterceptor(close)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      removeBack()
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const clamp = useCallback((next: Transform): Transform => {
    const img = imgRef.current
    if (!img) return next
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale))
    if (scale === 1) return { scale: 1, x: 0, y: 0 }
    const rect = img.getBoundingClientRect()
    const baseW = rect.width / tRef.current.scale
    const baseH = rect.height / tRef.current.scale
    const maxX = Math.max(0, (baseW * scale - baseW) / 2)
    const maxY = Math.max(0, (baseH * scale - baseH) / 2)
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }, [])

  /** Zoom to `nextScale`, keeping the point (cx, cy) in client coords fixed. */
  const zoomAround = useCallback(
    (nextScale: number, cx: number, cy: number) => {
      const img = imgRef.current
      if (!img) return
      const rect = img.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const s0 = tRef.current.scale
      const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
      const k = s1 / s0
      const fx = cx - centerX
      const fy = cy - centerY
      setT(
        clamp({
          scale: s1,
          x: tRef.current.x + fx * (1 - k),
          y: tRef.current.y + fy * (1 - k),
        }),
      )
    },
    [clamp],
  )

  function onPointerDown(e: React.PointerEvent) {
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      // Ignore — capture is a nicety, not required for the gesture to work.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    downAt.current = Date.now()
    if (pointers.current.size === 2) {
      pinchDist.current = twoPointerDist()
      panFrom.current = null
    } else {
      panFrom.current = { x: e.clientX, y: e.clientY }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const dist = twoPointerDist()
      const mid = twoPointerMid()
      if (pinchDist.current != null && dist > 0) {
        moved.current = true
        zoomAround(
          tRef.current.scale * (dist / pinchDist.current),
          mid.x,
          mid.y,
        )
      }
      pinchDist.current = dist
      return
    }

    if (panFrom.current && tRef.current.scale > 1) {
      const dx = e.clientX - panFrom.current.x
      const dy = e.clientY - panFrom.current.y
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved.current = true
      panFrom.current = { x: e.clientX, y: e.clientY }
      setT(clamp({ ...tRef.current, x: tRef.current.x + dx, y: tRef.current.y + dy }))
    } else if (panFrom.current) {
      const dx = e.clientX - panFrom.current.x
      const dy = e.clientY - panFrom.current.y
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved.current = true
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasTap =
      !moved.current && Date.now() - downAt.current < 400 && pointers.current.size <= 1
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchDist.current = null
    if (pointers.current.size === 0) panFrom.current = null

    if (!wasTap) return
    const now = Date.now()
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0
      if (tRef.current.scale > 1) setT({ scale: 1, x: 0, y: 0 })
      else zoomAround(3, e.clientX, e.clientY)
    } else {
      lastTapAt.current = now
      // A lone tap on the backdrop (not the zoomed image) closes.
      if (tRef.current.scale === 1) {
        window.setTimeout(() => {
          if (lastTapAt.current === now) onClose()
        }, DOUBLE_TAP_MS)
      }
    }
  }

  function onWheel(e: React.WheelEvent) {
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    zoomAround(tRef.current.scale * factor, e.clientX, e.clientY)
  }

  function twoPointerDist() {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function twoPointerMid() {
    const [a, b] = [...pointers.current.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  return (
    <div
      className="fixed inset-0 z-[60] touch-none select-none overflow-hidden overscroll-none bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      {!loaded && (
        <Loader2 className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/70" />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        style={{
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transition:
            pinchDist.current == null && !panFrom.current
              ? 'transform 0.15s ease-out'
              : 'none',
          cursor: t.scale > 1 ? 'grab' : 'zoom-in',
        }}
        className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
      />

      <button
        type="button"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Close photo viewer"
        className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
      >
        <X className="size-4" />
        Close
      </button>

      <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/60">
        Pinch or double-tap to zoom · drag to pan
      </p>
    </div>
  )
}
