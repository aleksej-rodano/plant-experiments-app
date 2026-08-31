import { AlarmClock, Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CARE_TILE_CLASS, careStatus } from '../lib/utils/care'
import type { Folder } from '../types/database'

interface Props {
  folder: Folder
  /** Stamp care_last_done_on to today. */
  onMarkDone: () => Promise<void>
}

/**
 * The recurring-chore status at the top of a folder — what's due, when, and a
 * one-tap way to reset the clock. Falls back to a quiet prompt when the folder
 * has no schedule set up yet.
 */
export default function CareBanner({ folder, onMarkDone }: Props) {
  const [busy, setBusy] = useState(false)
  const status = careStatus(folder)

  if (!status) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
        <span className="flex items-center gap-2">
          <AlarmClock className="size-4 shrink-0" />
          No reminder set for this folder.
        </span>
        <Link
          to={`/folders/${folder.id}/edit`}
          state={{ folder }}
          className="font-medium underline"
        >
          Set one up
        </Link>
      </div>
    )
  }

  async function handleMarkDone() {
    setBusy(true)
    try {
      await onMarkDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
        CARE_TILE_CLASS[status.state]
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <AlarmClock className="size-4 shrink-0" />
        <span className="min-w-0">
          <span className="font-medium">{status.label}</span> — {status.text}
          <span className="block text-xs opacity-80">
            every {status.intervalDays} day
            {status.intervalDays === 1 ? '' : 's'}
            {folder.care_last_done_on
              ? ` · last done ${folder.care_last_done_on}`
              : ' · never marked done'}
          </span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => void handleMarkDone()}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface/70 px-3 py-1.5 text-sm font-medium text-on-surface backdrop-blur hover:bg-surface disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Mark done
      </button>
    </div>
  )
}
