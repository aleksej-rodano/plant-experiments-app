import type { DateLog, Experiment, Pot, Potting } from '../../types/database'
import { groupByExperiment, phase1Spare, phase2Alive } from './phases'

/** "A propagating · B potted" for one experiment or a whole folder. */
export interface PhaseCounts {
  /** Plants still in Phase 1: `plant_count − Phase 1 deaths − plants potted`. */
  propagating: number
  /** Plants alive in pots (`phase2Alive`). */
  potted: number
}

export const NO_PHASE_COUNTS: PhaseCounts = { propagating: 0, potted: 0 }

type LogRow = Pick<
  DateLog,
  'id' | 'log_date' | 'deaths_count' | 'phase' | 'pot_id' | 'deleted_at'
>

/** Counts for one experiment; an experiment without a plant count has zero propagating. */
export function experimentPhaseCounts(
  experiment: Pick<Experiment, 'plant_count'>,
  logs: LogRow[],
  pottings: Potting[],
  pots: Pot[],
): PhaseCounts {
  const input = { experiment, pottings, pots, logs }
  return {
    propagating: phase1Spare(input) ?? 0,
    potted: phase2Alive(input),
  }
}

/** Counts per experiment id, from folder-wide (or app-wide) lists of rows. */
export function phaseCountsByExperiment(
  experiments: Pick<Experiment, 'id' | 'plant_count'>[],
  logs: (LogRow & { experiment_id: string })[],
  pottings: Potting[],
  pots: Pot[],
): Map<string, PhaseCounts> {
  const logsBy = groupByExperiment(logs)
  const pottingsBy = groupByExperiment(pottings)
  const potsBy = groupByExperiment(pots)
  const out = new Map<string, PhaseCounts>()
  for (const e of experiments) {
    out.set(
      e.id,
      experimentPhaseCounts(
        e,
        logsBy.get(e.id) ?? [],
        pottingsBy.get(e.id) ?? [],
        potsBy.get(e.id) ?? [],
      ),
    )
  }
  return out
}

export function addPhaseCounts(a: PhaseCounts, b: PhaseCounts): PhaseCounts {
  return {
    propagating: a.propagating + b.propagating,
    potted: a.potted + b.potted,
  }
}

/** "12 propagating · 4 potted" */
export function phaseCountsLabel(c: PhaseCounts): string {
  return `${c.propagating} propagating · ${c.potted} potted`
}
