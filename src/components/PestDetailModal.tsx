import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { PestGuide } from '../types/database'

interface Props {
  guide: PestGuide
  onClose: () => void
}

export default function PestDetailModal({ guide, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pest-modal-title"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="pest-modal-title"
            className="text-lg font-medium text-on-surface"
          >
            {guide.pest_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 shrink-0 rounded-full p-1 text-on-surface-variant hover:bg-surface-variant"
          >
            <X className="size-5" />
          </button>
        </div>

        <h3 className="mb-2 text-sm font-medium text-on-surface-variant">
          Treatment steps
        </h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-on-surface">
          {guide.treatment_steps.map((step, i) => (
            <li key={i} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
