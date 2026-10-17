import { Camera, ClipboardPlus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isNativeApp } from '../lib/native'
import { binPotting } from '../lib/utils/bin'
import { potAlive, type PhaseInput } from '../lib/utils/phases'
import { logPotCare, potLogNewPath, potPhotoPath } from '../lib/utils/potLogs'
import { plantsLabel, potsLabel } from '../lib/utils/potting'
import type { Pot, Potting } from '../types/database'
import QuickCareButtons from './QuickCareButtons'

interface Props {
  experimentId: string
  pottings: Potting[]
  pots: Pot[]
  /** Accounting input (with the experiment's logs) for potAlive and the delete summary. */
  phaseInput: PhaseInput
  /** Called after a potting went to the bin, so the parent can refresh. */
  onDeleted: () => void
  /** Called after a one-tap watered / fertilized entry was saved on a pot, with a toast message. */
  onLogged?: (message: string) => void
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * The experiment's potting events and their pots. Plain and self-contained so
 * it can move into the Phase 2 tab later: renders nothing without a potting.
 */
export default function PottingsSection({
  experimentId,
  pottings,
  pots,
  phaseInput,
  onDeleted,
  onLogged,
}: Props) {
  const [careKey, setCareKey] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (pottings.length === 0) return null

  const sorted = [...pottings].sort((a, b) =>
    a.potted_on === b.potted_on
      ? b.created_at.localeCompare(a.created_at)
      : b.potted_on.localeCompare(a.potted_on),
  )

  async function handleCare(pot: Pot, kind: 'watered' | 'fertilized') {
    setCareKey(`${pot.id}:${kind}`)
    setError(null)
    try {
      await logPotCare(experimentId, pot.id, kind)
      onLogged?.(
        kind === 'watered'
          ? `Logged: ${pot.label} watered today.`
          : `Logged: ${pot.label} fertilized today.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the quick log.')
    } finally {
      setCareKey(null)
    }
  }

  async function handleDelete(pottingId: string) {
    setDeletingId(pottingId)
    setError(null)
    try {
      await binPotting(pottingId)
      setConfirmingId(null)
      onDeleted()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to delete the potting.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-medium text-on-surface">Pottings</h2>
      {error && (
        <p className="mb-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {sorted.map((potting) => {
          const own = pots
            .filter((p) => p.potting_id === potting.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
          const plantTotal = own.reduce((sum, p) => sum + p.plant_count, 0)
          const potIds = new Set(own.map((p) => p.id))
          const checkIns = phaseInput.logs.filter(
            (l) => l.pot_id != null && potIds.has(l.pot_id) && !l.deleted_at,
          ).length
          const confirming = confirmingId === potting.id
          const deleting = deletingId === potting.id

          return (
            <li
              key={potting.id}
              className="rounded-lg bg-surface-container p-3"
            >
              <p className="text-sm font-medium text-on-surface">
                {formatDate(potting.potted_on)}
              </p>
              <p className="text-sm text-on-surface-variant">
                {plantsLabel(plantTotal)} · {potsLabel(own.length)}
              </p>
              {potting.notes && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">
                  {potting.notes}
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-2">
                {own.map((pot) => {
                  const detail = [pot.pot_size, pot.substrate]
                    .filter(Boolean)
                    .join(' · ')
                  const careBusy = careKey?.startsWith(`${pot.id}:`) ?? false
                  return (
                    <li
                      key={pot.id}
                      className="flex flex-col gap-2 rounded-lg bg-surface px-2 py-2"
                    >
                      <div className="flex items-center gap-3">
                        {pot.image_url ? (
                          <img
                            src={pot.image_url}
                            alt={pot.label}
                            loading="lazy"
                            className="size-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="size-14 shrink-0 rounded-lg bg-surface-variant" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {pot.label}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {potAlive(phaseInput, pot)}/{pot.plant_count} alive
                            {detail && ` · ${detail}`}
                          </p>
                        </div>
                        <Link
                          to={`/experiments/${experimentId}/pots/${pot.id}/edit`}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
                        >
                          <Pencil className="size-4" />
                          Edit pot
                        </Link>
                      </div>

                      {/* Every Phase 2 entry belongs to a pot, so the entry points
                          live on the pot: all of them write phase='potted' + pot_id. */}
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={potLogNewPath(experimentId, pot.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-on-primary hover:opacity-90"
                          >
                            <ClipboardPlus className="size-4" />
                            Add check-in
                          </Link>
                          {/* Photo-only logging is web-only, like the experiment's
                              own "Log photo"; on the phone the check-in form has
                              the camera / gallery choice. */}
                          {!isNativeApp() && (
                            <Link
                              to={potPhotoPath(experimentId, pot.id)}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
                            >
                              <Camera className="size-4" />
                              Log photo
                            </Link>
                          )}
                        </div>
                        <QuickCareButtons
                          compact
                          pot={{ id: pot.id, label: pot.label }}
                          busy={careKey != null}
                          pending={
                            careBusy ? (careKey!.split(':')[1] as 'watered' | 'fertilized') : null
                          }
                          onLog={(kind) => void handleCare(pot, kind)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-3">
                {confirming ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-on-surface-variant">
                      Move this potting to the bin?{' '}
                      {plantsLabel(plantTotal)} return to Phase 1
                      {checkIns > 0
                        ? ` and ${checkIns} pot ${checkIns === 1 ? 'check-in goes' : 'check-ins go'} to the bin with it.`
                        : '. It has no pot check-ins.'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={deleting}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-variant"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(potting.id)}
                        disabled={deleting}
                        className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-on-error disabled:opacity-60"
                      >
                        {deleting && <Loader2 className="size-4 animate-spin" />}
                        Delete potting
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(potting.id)}
                    className="flex items-center gap-1.5 text-sm font-medium text-error hover:underline"
                  >
                    <Trash2 className="size-4" />
                    Delete potting
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
