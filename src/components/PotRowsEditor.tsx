import { Plus, Trash2 } from 'lucide-react'
import {
  newPotRow,
  plantsLabel,
  potsLabel,
  validatePotRows,
  type PotRowDraft,
} from '../lib/utils/potting'
import { validateImage } from '../lib/utils/image'
import CoverImagePicker from './CoverImagePicker'

interface Props {
  rows: PotRowDraft[]
  onChange: (rows: PotRowDraft[]) => void
  /**
   * Plants that may still be potted (`phase1Spare`), or null for no cap. Drives
   * the running total and its over-limit warning.
   */
  available: number | null
  /** Show per-row errors (turn on after the first save attempt). */
  showErrors?: boolean
  disabled?: boolean
  /** Numbering for an added row: "Pot <firstNumber + rows.length>". Default 1. */
  firstNumber?: number
}

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

/**
 * Controlled editor for the list of pots in one potting: label, plants, size,
 * substrate, notes and photo per row, with "Add another pot" / "Remove pot".
 * Keeps no state of its own; the parent owns `rows` and runs
 * `validatePotRows(rows, available)` (from utils/potting) before saving.
 */
export default function PotRowsEditor({
  rows,
  onChange,
  available,
  showErrors = false,
  disabled = false,
  firstNumber = 1,
}: Props) {
  const validation = validatePotRows(rows, available)

  function patch(key: string, change: Partial<PotRowDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)))
  }

  function pickImage(key: string, file: File | undefined) {
    if (!file) return
    const problem = validateImage(file)
    if (problem) patch(key, { imageError: problem })
    else patch(key, { image: file, imageError: '' })
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => {
        const err = showErrors ? validation.rows[row.key] : undefined
        return (
          <fieldset
            key={row.key}
            disabled={disabled}
            className="flex min-w-0 flex-col gap-3 rounded-lg bg-surface-container p-3"
          >
            <legend className="sr-only">Pot {i + 1}</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
              <label className="flex min-w-0 flex-col gap-1 text-sm text-on-surface-variant">
                Label *
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => patch(row.key, { label: e.target.value })}
                  className={inputClass}
                />
                {err?.label && (
                  <span className="text-xs text-error">{err.label}</span>
                )}
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm text-on-surface-variant">
                Plants *
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={row.plants}
                  onChange={(e) => patch(row.key, { plants: e.target.value })}
                  className={inputClass}
                />
                {err?.plants && (
                  <span className="text-xs text-error">{err.plants}</span>
                )}
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                Pot size
                <input
                  type="text"
                  value={row.size}
                  onChange={(e) => patch(row.key, { size: e.target.value })}
                  placeholder="e.g. 10 cm"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                Substrate
                <input
                  type="text"
                  value={row.substrate}
                  onChange={(e) =>
                    patch(row.key, { substrate: e.target.value })
                  }
                  placeholder="e.g. peat + perlite"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Notes
              <textarea
                rows={2}
                value={row.notes}
                onChange={(e) => patch(row.key, { notes: e.target.value })}
                className={inputClass}
              />
            </label>

            <CoverImagePicker
              image={row.image}
              onPick={(f) => pickImage(row.key, f)}
              onClear={() => patch(row.key, { image: null, imageError: '' })}
              label="Pot photo (optional)"
              error={row.imageError || undefined}
            />

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                className="flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-sm font-medium text-error hover:bg-error-container"
              >
                <Trash2 className="size-4" />
                Remove pot
              </button>
            )}
          </fieldset>
        )
      })}

      <button
        type="button"
        onClick={() => onChange([...rows, newPotRow(firstNumber + rows.length)])}
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-primary ring-1 ring-outline hover:bg-surface-variant disabled:opacity-50"
      >
        <Plus className="size-4" />
        Add another pot
      </button>

      <p
        className={`text-sm ${
          validation.overBy > 0
            ? 'font-medium text-error'
            : 'text-on-surface-variant'
        }`}
      >
        {plantsLabel(validation.total)} in {potsLabel(rows.length)}
        {available != null && ` · ${available} available`}
        {validation.overBy > 0 &&
          ` — ${validation.overBy} too many, reduce the plants in the pots.`}
      </p>
    </div>
  )
}
