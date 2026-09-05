import { Droplets, FlaskConical, Loader2 } from 'lucide-react'

interface Props {
  /** Log a today-dated entry with the matching flag set. */
  onLog: (kind: 'watered' | 'fertilized') => void
  /** Disable while a save is in flight. */
  busy: boolean
  /** Which button, if any, is currently saving — shows a spinner on it. */
  pending?: 'watered' | 'fertilized' | null
}

/**
 * One-tap "I did this today" buttons for the add-log forms. Each writes a
 * log entry dated today with no other detail required, then returns to the
 * timeline — for the common case of just recording that a plant was watered
 * or fertilized.
 */
export default function QuickCareButtons({ onLog, busy, pending }: Props) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-sm text-on-surface-variant">
        Quick log — dated today, nothing else needed
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onLog('watered')}
          className="flex items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 text-sm font-medium text-on-secondary-container hover:opacity-90 disabled:opacity-60"
        >
          {pending === 'watered' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Droplets className="size-4" />
          )}
          Plant watered
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onLog('fertilized')}
          className="flex items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-3 text-sm font-medium text-on-secondary-container hover:opacity-90 disabled:opacity-60"
        >
          {pending === 'fertilized' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FlaskConical className="size-4" />
          )}
          Fertilized
        </button>
      </div>
    </fieldset>
  )
}
