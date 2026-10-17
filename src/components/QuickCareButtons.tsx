import { Droplets, FlaskConical, Loader2 } from 'lucide-react'

type Kind = 'watered' | 'fertilized'

interface Props {
  /** Log a today-dated entry with the matching flag set. */
  onLog: (kind: Kind) => void
  /** Disable while a save is in flight. */
  busy: boolean
  /** Which button, if any, is currently saving — shows a spinner on it. */
  pending?: Kind | null
  /** Which buttons to show; both by default. */
  kinds?: Kind[]
  /**
   * Phase 2: the pot the entry is logged against. The caller writes
   * phase='potted' + pot_id; here it only names the pot in the legend and for
   * screen readers.
   */
  pot?: { id: string; label: string }
  /** No box or legend — a bare button row, for use inside a pot card. */
  compact?: boolean
}

const BUTTONS: Record<Kind, { label: string; Icon: typeof Droplets }> = {
  watered: { label: 'Plant watered', Icon: Droplets },
  fertilized: { label: 'Fertilized', Icon: FlaskConical },
}

/**
 * One-tap "I did this today" buttons for the add-log forms. Each writes a
 * log entry dated today with no other detail required, then returns to the
 * timeline — for the common case of just recording that a plant was watered
 * or fertilized.
 */
export default function QuickCareButtons({
  onLog,
  busy,
  pending,
  kinds = ['watered', 'fertilized'],
  pot,
  compact = false,
}: Props) {
  const buttons = (
    <div
      className={`grid gap-2 ${kinds.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
    >
      {kinds.map((kind) => {
        const { label, Icon } = BUTTONS[kind]
        return (
          <button
            key={kind}
            type="button"
            disabled={busy}
            onClick={() => onLog(kind)}
            aria-label={pot ? `${label} — ${pot.label}` : undefined}
            className={`flex items-center justify-center gap-2 rounded-lg bg-secondary-container font-medium text-on-secondary-container hover:opacity-90 disabled:opacity-60 ${
              compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
            }`}
          >
            {pending === kind ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4" />
            )}
            {label}
          </button>
        )
      })}
    </div>
  )

  if (compact) return buttons

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-sm text-on-surface-variant">
        {pot
          ? `Quick log for ${pot.label} — dated today, nothing else needed`
          : 'Quick log — dated today, nothing else needed'}
      </legend>
      {buttons}
    </fieldset>
  )
}
