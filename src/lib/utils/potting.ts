import { supabase } from '../supabase'
import { removeStoredImages, uploadImage } from './image'
import type { PotInput } from '../../types/database'

/**
 * One editable pot row in the "Pot plants" flow (PotRowsEditor). Strings stay
 * strings so a half-typed number does not fight the input; `toPotInputs` parses
 * them once the rows have passed `validatePotRows`.
 */
export interface PotRowDraft {
  /** Stable React key; never sent to the server. */
  key: string
  label: string
  plants: string
  size: string
  substrate: string
  notes: string
  /** A newly picked photo, uploaded on save. */
  image: File | null
  /** Picker complaint (wrong type / too big), cleared on the next pick. */
  imageError: string
}

/** A blank row labelled "Pot <number>". */
export function newPotRow(number: number): PotRowDraft {
  return {
    key: crypto.randomUUID(),
    label: `Pot ${number}`,
    plants: '1',
    size: '',
    substrate: '',
    notes: '',
    image: null,
    imageError: '',
  }
}

export interface PotRowErrors {
  label?: string
  plants?: string
  image?: string
}

export interface PotRowsValidation {
  /** Errors by row key; a row with no problems has no entry. */
  rows: Record<string, PotRowErrors>
  /** Σ plants over rows whose count parses (what the save would move). */
  total: number
  /** How many plants the rows hold beyond `available` (0 when within it or uncapped). */
  overBy: number
  ok: boolean
}

/**
 * Per-row checks (label present, whole number of plants ≥ 1, photo accepted) plus
 * the total against `available` — pass `phase1Spare(...)`, or null for no cap.
 * R2/S3 readiness is never checked here: it is only a hint.
 */
export function validatePotRows(
  rows: PotRowDraft[],
  available: number | null,
): PotRowsValidation {
  const errors: Record<string, PotRowErrors> = {}
  let total = 0
  for (const row of rows) {
    const e: PotRowErrors = {}
    if (!row.label.trim()) e.label = 'Give the pot a label.'
    const n = Number(row.plants)
    if (!row.plants.trim() || !Number.isInteger(n) || n < 1) {
      e.plants = 'Enter a whole number of at least 1.'
    } else {
      total += n
    }
    if (row.imageError) e.image = row.imageError
    if (Object.keys(e).length > 0) errors[row.key] = e
  }
  const overBy = available == null ? 0 : Math.max(0, total - available)
  return {
    rows: errors,
    total,
    overBy,
    ok: rows.length > 0 && Object.keys(errors).length === 0 && overBy === 0,
  }
}

/** Rows (already validated) → RPC payload; `urls` maps row key → uploaded photo URL. */
export function toPotInputs(
  rows: PotRowDraft[],
  urls: Map<string, string>,
): PotInput[] {
  return rows.map((r) => ({
    label: r.label.trim(),
    plant_count: Number(r.plants),
    pot_size: r.size.trim() || null,
    substrate: r.substrate.trim() || null,
    notes: r.notes.trim() || null,
    image_url: urls.get(r.key) ?? null,
  }))
}

/**
 * Save one potting: upload the row photos, then call `create_potting` once. If
 * anything fails the photos uploaded so far are deleted again, so a failed save
 * leaves no orphans and the form can simply be resubmitted. Throws the RPC's own
 * message (e.g. the "more than available" refusal) on failure.
 */
export async function savePotting(opts: {
  experimentId: string
  userId: string
  pottedOn: string
  notes: string
  rows: PotRowDraft[]
}): Promise<string> {
  const urls = new Map<string, string>()
  try {
    for (const row of opts.rows) {
      if (row.image) urls.set(row.key, await uploadImage(row.image, opts.userId))
    }
    const { data, error } = await supabase.rpc('create_potting', {
      p_experiment_id: opts.experimentId,
      p_potted_on: opts.pottedOn,
      p_notes: opts.notes.trim() || null,
      p_pots: toPotInputs(opts.rows, urls),
    })
    if (error) throw new Error(error.message)
    return data
  } catch (e) {
    if (urls.size > 0) await removeStoredImages([...urls.values()])
    throw e
  }
}

/** "5 plants" / "1 plant" */
export function plantsLabel(n: number): string {
  return `${n} ${n === 1 ? 'plant' : 'plants'}`
}

/** "2 pots" / "1 pot" */
export function potsLabel(n: number): string {
  return `${n} ${n === 1 ? 'pot' : 'pots'}`
}
