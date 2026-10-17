import type { DateLog, Experiment, Pot, Potting } from '../../types/database'
import type { StageSnapshot } from './stages'

/**
 * Plant accounting for the two phases (PHASE2_PLAN.md section 5). Pure
 * functions over plain arrays — no Supabase, no React — so every screen shares
 * one definition of "how many plants are where".
 *
 * Vocabulary
 *   Phase 1  propagation: root / leaf tracks. Plants leave it by *potting* or by a
 *            Phase 1 death (`date_logs.phase = 'propagation'`, `pot_id` null).
 *   Phase 2  potted: plants live in pots; deaths are logged per pot
 *            (`date_logs.phase = 'potted'`, `pot_id` set).
 *
 * Which rows count: a row with `deleted_at` set is ignored, and so is any pot
 * whose potting is binned (pots are binned together with their potting, but the
 * check is made here too so a half-loaded bin batch cannot skew the numbers).
 * A potting dated D has already happened for any Phase 1 check-in dated D.
 *
 * The Phase 1 figures
 *   phase1Cohort(asOf)    = plant_count − Σ pots potted on or before asOf
 *       Plants that were still part of Phase 1 on that date, *deaths not netted
 *       off*. This is the denominator of the stage snapshot percentages and the
 *       stage warnings. For an experiment with no pottings it is exactly
 *       `plant_count`, which is what those screens always divided by.
 *   phase1Remaining(asOf) = phase1Cohort(asOf) − Σ Phase 1 deaths on or before asOf
 *       Plants physically still in Phase 1 on that date. Shown as a count.
 *   phase1Spare()         = plant_count − Σ ALL Phase 1 deaths − Σ ALL pots
 *       Phase 1 only ever shrinks, so how many plants can still *leave* it
 *       (potting or a Phase 1 death) is set by the LATEST point in time, not by
 *       the date of the entry being added. A backdated potting or death must
 *       leave room for the ones that come after it, so "plants available to
 *       pot" and the cap on new/edited Phase 1 deaths both use phase1Spare.
 *       (The `create_potting` RPC enforces the same rule.)
 *
 * The Phase 2 / overall figures
 *   potAlive(pot, asOf)   = pot.plant_count − Σ deaths of logs with that pot_id
 *                           dated on or before asOf
 *   phase2Alive(asOf)     = Σ potAlive over live pots potted on or before asOf
 *   totalAlive            = plant_count − Σ every live death (Phase 1 and pots)
 *   pottedShare           = Σ live pot.plant_count / plant_count   (informational)
 *
 * Worked examples (plant_count = 10)
 *   Phase 1 deaths: 1 on 01-10, 2 on 01-20.
 *   Potting on 01-15 → pot A holds 3 plants, pot B holds 2.
 *   Pot death: 1 in pot A on 01-25.
 *
 *   1. Before the potting (asOf 01-12):
 *        cohort = 10, remaining = 10 − 1 = 9.
 *   2. On the potting date (asOf 01-15; potting counts on its own date):
 *        cohort = 10 − 5 = 5, remaining = 5 − 1 = 4.
 *   3. After everything (asOf 01-25):
 *        cohort = 5, remaining = 5 − 3 = 2.
 *        potAlive(A) = 3 − 1 = 2 (but 3 on 01-24), potAlive(B) = 2,
 *        phase2Alive = 4, totalAlive = 10 − (1 + 2 + 1) = 6 = 2 + 4,
 *        pottedShare = 5 / 10 = 0.5, phase1Spare = 10 − 3 − 5 = 2.
 *   4. Backdating: a new potting dated 01-02 can take at most phase1Spare = 2
 *      plants even though phase1Remaining(01-02) is 10 — taking more would
 *      leave the 01-10 / 01-20 deaths and the 01-15 potting without plants.
 *      Editing the 01-20 death (2 plants) caps it at 2 + 2 = 4: its own deaths
 *      are added back (`excludeLogId`).
 *   5. Ready to pot: latest Phase 1 snapshot R2 = 4, S3 = 3 → "up to 3 may be
 *      ready (R2: 4, S3: 3)". Display only; nothing is enforced.
 */

/** Everything the accounting needs for ONE experiment. Pass `[]` for none. */
export interface PhaseInput {
  experiment: Pick<Experiment, 'plant_count'>
  pottings: Pick<Potting, 'id' | 'potted_on' | 'deleted_at'>[]
  pots: Pick<Pot, 'id' | 'potting_id' | 'plant_count' | 'deleted_at'>[]
  logs: Pick<
    DateLog,
    'id' | 'log_date' | 'deaths_count' | 'phase' | 'pot_id' | 'deleted_at'
  >[]
}

/** A pot with the date it was potted, after dropping binned rows. */
interface LivePot {
  id: string
  plant_count: number
  potted_on: string
}

function livePots(input: PhaseInput): LivePot[] {
  const dates = new Map<string, string>()
  for (const p of input.pottings) {
    if (!p.deleted_at) dates.set(p.id, p.potted_on)
  }
  const out: LivePot[] = []
  for (const pot of input.pots) {
    if (pot.deleted_at) continue
    const potted_on = dates.get(pot.potting_id)
    if (potted_on == null) continue
    out.push({ id: pot.id, plant_count: pot.plant_count, potted_on })
  }
  return out
}

const deathsOf = (l: { deaths_count: number | null }) => l.deaths_count ?? 0

/** Live Phase 1 (propagation) logs. */
function phase1Logs(input: PhaseInput) {
  return input.logs.filter((l) => !l.deleted_at && l.phase !== 'potted')
}

/** Group any experiment-keyed rows by `experiment_id`. */
export function groupByExperiment<T extends { experiment_id: string }>(
  rows: T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const list = out.get(row.experiment_id)
    if (list) list.push(row)
    else out.set(row.experiment_id, [row])
  }
  return out
}

/**
 * Plants still part of Phase 1 on `asOf` (`yyyy-mm-dd`): `plant_count` minus the
 * pots potted on or before that date. Deaths are NOT subtracted — this is the
 * denominator for stage percentages and warnings. Null without a plant count.
 */
export function phase1Cohort(input: PhaseInput, asOf: string): number | null {
  const total = input.experiment.plant_count
  if (total == null) return null
  const potted = livePots(input)
    .filter((p) => p.potted_on <= asOf)
    .reduce((sum, p) => sum + p.plant_count, 0)
  return Math.max(0, total - potted)
}

/**
 * Plants physically in Phase 1 on `asOf`: the cohort minus Phase 1 deaths dated
 * on or before it. Null without a plant count.
 */
export function phase1Remaining(
  input: PhaseInput,
  asOf: string,
): number | null {
  const cohort = phase1Cohort(input, asOf)
  if (cohort == null) return null
  return Math.max(0, cohort - phase1Deaths(input, asOf))
}

/**
 * Σ live Phase 1 deaths dated on or before `asOf` (default: all of them).
 * `excludeLogId` leaves one log out — the entry being edited — so the form can
 * reconcile its own deaths on top of everyone else's.
 */
export function phase1Deaths(
  input: PhaseInput,
  asOf?: string,
  opts?: { excludeLogId?: string | null },
): number {
  return phase1Logs(input)
    .filter(
      (l) =>
        l.id !== opts?.excludeLogId && (asOf == null || l.log_date <= asOf),
    )
    .reduce((sum, l) => sum + deathsOf(l), 0)
}

/**
 * Plants that can still leave Phase 1 — by potting or by a Phase 1 death —
 * regardless of the date being entered: `plant_count` minus every live Phase 1
 * death minus every live pot. Use it for "plants available to pot" and as the cap
 * on new / edited Phase 1 deaths. When editing an existing Phase 1 log, pass its
 * id as `excludeLogId` so its own deaths are added back. Null without a plant
 * count (no cap).
 */
export function phase1Spare(
  input: PhaseInput,
  opts?: { excludeLogId?: string | null },
): number | null {
  const total = input.experiment.plant_count
  if (total == null) return null
  const dead = phase1Deaths(input, undefined, opts)
  const potted = livePots(input).reduce((sum, p) => sum + p.plant_count, 0)
  return Math.max(0, total - dead - potted)
}

/**
 * How many plants Phase 1 is overdrawn by: the amount by which Phase 1 deaths plus
 * pots exceed `plant_count`. Zero for a consistent experiment — `phase1Spare`
 * clamps at zero and so cannot tell "none left" from "too many taken", this can.
 * Used to refuse a bin restore that would double-count plants.
 */
export function phase1Shortfall(input: PhaseInput): number {
  const total = input.experiment.plant_count
  if (total == null) return 0
  const potted = livePots(input).reduce((sum, p) => sum + p.plant_count, 0)
  return Math.max(0, phase1Deaths(input) + potted - total)
}

/**
 * Plants alive in one pot: its plant count minus the deaths logged against it,
 * up to `asOf` (default: all of them). `excludeLogId` adds one log's deaths back
 * (the cap when editing that log). Zero for a pot that is binned or whose
 * potting is — and for a pot that has not been potted yet on `asOf`.
 */
export function potAlive(
  input: PhaseInput,
  pot: string | { id: string },
  asOf?: string,
  opts?: { excludeLogId?: string | null },
): number {
  const potId = typeof pot === 'string' ? pot : pot.id
  const livePot = livePots(input).find((p) => p.id === potId)
  if (!livePot) return 0
  if (asOf != null && livePot.potted_on > asOf) return 0
  const dead = input.logs
    .filter(
      (l) =>
        !l.deleted_at &&
        l.pot_id === potId &&
        l.id !== opts?.excludeLogId &&
        (asOf == null || l.log_date <= asOf),
    )
    .reduce((sum, l) => sum + deathsOf(l), 0)
  return Math.max(0, livePot.plant_count - dead)
}

/** Plants alive across all pots potted on or before `asOf` (default: all). */
export function phase2Alive(input: PhaseInput, asOf?: string): number {
  return livePots(input)
    .filter((p) => asOf == null || p.potted_on <= asOf)
    .reduce((sum, p) => sum + potAlive(input, p.id, asOf), 0)
}

/** `plant_count − Σ every live death`, Phase 1 and pot deaths alike. Never negative. */
export function totalAlive(input: PhaseInput): number {
  const total = input.experiment.plant_count
  if (total == null) return 0
  const dead = input.logs
    .filter((l) => !l.deleted_at)
    .reduce((sum, l) => sum + deathsOf(l), 0)
  return Math.max(0, total - dead)
}

/** Fraction (0..1) of the original plants that have been potted. Null without a plant count. */
export function pottedShare(input: PhaseInput): number | null {
  const total = input.experiment.plant_count
  if (total == null || total <= 0) return null
  const potted = livePots(input).reduce((sum, p) => sum + p.plant_count, 0)
  return potted / total
}

export interface ReadyToPot {
  /** min(R2, S3): plants that are both rooted well and established. */
  count: number
  r2: number
  s3: number
}

/**
 * The "up to X may be ready" hint from the latest Phase 1 stage snapshot.
 * Display only — never enforced. Null when there is no snapshot.
 */
export function readyToPot(
  snapshot: Pick<StageSnapshot, 'entry'> | null,
): ReadyToPot | null {
  if (!snapshot) return null
  const r2 = snapshot.entry.root[2]
  const s3 = snapshot.entry.shoot[3]
  return { count: Math.min(r2, s3), r2, s3 }
}
