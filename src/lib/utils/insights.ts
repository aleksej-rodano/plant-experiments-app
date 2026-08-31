import type { DateLog, Experiment } from '../../types/database'
import { dayMs } from './chart'
import { successRate, survivorCount, totalDeaths } from './survival'

const DAY = 86_400_000

/** Whole days between two ISO `yyyy-mm-dd` dates, or null if either is missing. */
export function daysBetween(from: string | null, to: string | null) {
  if (!from || !to) return null
  return Math.round((dayMs(to) - dayMs(from)) / DAY)
}

/**
 * Days from the experiment's start to the first log that recorded `metric`.
 * Null when the experiment never reached that milestone.
 */
export function daysToFirst(
  experiment: Experiment,
  logs: DateLog[],
  metric: 'root_length_mm' | 'new_leaves',
): number | null {
  const reached = logs
    .filter((l) => {
      const v = l[metric]
      return v != null && v > 0
    })
    .map((l) => l.log_date)
    .sort()
  if (reached.length === 0) return null
  const days = daysBetween(experiment.started_on, reached[0])
  // A log back-dated before the start would give a negative age; clamp to 0.
  return days == null ? null : Math.max(0, days)
}

export interface ExperimentSummary {
  experiment: Experiment
  logs: DateLog[]
  initial: number | null
  deaths: number
  alive: number
  /** survivors / initial, or null with no plant count to divide by. */
  rate: number | null
  daysToRoot: number | null
  daysToLeaf: number | null
  /** Largest root measurement recorded, in mm. */
  maxRootMm: number | null
  lastLogDate: string | null
}

export function summarise(
  experiment: Experiment,
  logs: DateLog[],
): ExperimentSummary {
  const deaths = totalDeaths(logs)
  const initial = experiment.plant_count ?? null
  const roots = logs
    .map((l) => l.root_length_mm)
    .filter((v): v is number => v != null)
  const dates = logs.map((l) => l.log_date).sort()

  return {
    experiment,
    logs,
    initial,
    deaths,
    alive: survivorCount(initial, deaths),
    rate: successRate(initial, deaths),
    daysToRoot: daysToFirst(experiment, logs, 'root_length_mm'),
    daysToLeaf: daysToFirst(experiment, logs, 'new_leaves'),
    maxRootMm: roots.length > 0 ? Math.max(...roots) : null,
    lastLogDate: dates.length > 0 ? dates[dates.length - 1] : null,
  }
}

/** Group logs by experiment and summarise each, ordered as `experiments` is. */
export function summariseAll(
  experiments: Experiment[],
  logs: DateLog[],
): ExperimentSummary[] {
  const byExp = new Map<string, DateLog[]>()
  for (const log of logs) {
    const list = byExp.get(log.experiment_id)
    if (list) list.push(log)
    else byExp.set(log.experiment_id, [log])
  }
  return experiments.map((e) => summarise(e, byExp.get(e.id) ?? []))
}

/**
 * Best and worst treatments by survival rate. Only experiments with a plant
 * count can be ranked, and a verdict needs at least two of them with
 * *different* rates — otherwise there's nothing to call.
 */
export function rankBySurvival(summaries: ExperimentSummary[]) {
  const ranked = summaries
    .filter((s) => s.rate != null)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
  if (ranked.length < 2) return null
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  if (best.rate === worst.rate) return null
  return { best, worst, ranked }
}

/** Fastest to put out roots. Null until two experiments have actually rooted. */
export function fastestToRoot(summaries: ExperimentSummary[]) {
  const rooted = summaries
    .filter((s) => s.daysToRoot != null)
    .sort((a, b) => (a.daysToRoot ?? 0) - (b.daysToRoot ?? 0))
  return rooted.length >= 2 ? rooted[0] : null
}

/**
 * Survival rate at each log date: 1 at the start, stepping down as deaths
 * accumulate. Returns nothing without a plant count to divide by.
 */
export function survivalSeries(
  experiment: Experiment,
  logs: DateLog[],
): { t: number; value: number }[] {
  const initial = experiment.plant_count ?? 0
  if (initial <= 0) return []

  const sorted = [...logs].sort((a, b) => dayMs(a.log_date) - dayMs(b.log_date))
  const points: { t: number; value: number }[] = []
  if (experiment.started_on) {
    points.push({ t: dayMs(experiment.started_on), value: 100 })
  }

  let running = 0
  for (const log of sorted) {
    running += log.deaths_count ?? 0
    const t = dayMs(log.log_date)
    const value = Math.round((survivorCount(initial, running) / initial) * 100)
    // One point per date: a later entry on the same day supersedes the earlier.
    const existing = points.findIndex((p) => p.t === t)
    if (existing >= 0) points[existing] = { t, value }
    else points.push({ t, value })
  }
  return points
}
