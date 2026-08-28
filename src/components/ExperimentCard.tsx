import { Loader2, MapPin, Sprout, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Experiment } from '../types/database'

interface Props {
  experiment: Experiment
  onDelete: (id: string) => Promise<void>
}

export default function ExperimentCard({ experiment, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(experiment.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg bg-surface-container ring-1 ring-outline-variant">
      <Link
        to={`/experiments/${experiment.id}`}
        state={{ experiment }}
        className="flex flex-1 flex-col"
      >
        <div className="flex aspect-video items-center justify-center bg-surface-variant">
          {experiment.cover_image_url ? (
            <img
              src={experiment.cover_image_url}
              alt={experiment.title}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <Sprout className="size-10 text-on-surface-variant/50" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h2 className="line-clamp-2 font-medium text-on-surface">{experiment.title}</h2>
          <p className="text-sm text-on-surface-variant">
            {experiment.plant_count} plant{experiment.plant_count === 1 ? '' : 's'}
          </p>
          <p className="mt-auto flex items-center gap-1 text-xs text-on-surface-variant">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{experiment.origin}</span>
          </p>
        </div>
      </Link>

      {confirming ? (
        <div className="flex items-center gap-2 border-t border-outline-variant p-2">
          <span className="flex-1 text-xs text-on-surface-variant">Delete this experiment?</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-1 rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error disabled:opacity-60"
          >
            {deleting && <Loader2 className="size-3 animate-spin" />}
            Delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Delete experiment"
          className="absolute right-2 top-2 rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}
