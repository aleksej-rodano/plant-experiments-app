import type { DateLog, Experiment } from '../../types/database'
import { dayMs, daysBetween } from './date'
import {
  daysToStage,
  reachedRoot,
  reachedShoot,
  stageSnapshot,
  type StageLog,
  type StageSnapshot,
} from './stages'
import { successRate, survivorCount, totalDeaths } from './survival'

export { daysBetween }

/** What summarising a log needs: the stage columns plus its owning experiment. */
export type SummaryLog = StageLog & Pick<DateLog, 'experiment_id'>

export interface ExperimentSummary {
  experiment: Experiment
  logs: SummaryLog[]
  initial: number | null
  deaths: number
  alive: number
  /** survivors / initial, or null with no plant count to divide by. */
  rate: number | null
  /** Days from start to the first check-in with any plant at R1+. */
  daysToRoot: number | null
  /** Days from start to the first check-in with any plant at S1+. */
  daysToLeaf: number | null
  /** Latest check-in that recorded stage counts, with percentages. */
  snapshot: StageSnapshot | null
  lastLogDate: string | null
}

export function summarise(
  experiment: Experiment,
  logs: SummaryLog[],
): ExperimentSummary {
  const deaths = totalDeaths(logs)
  const initial = experiment.plant_count ?? null
  const dates = logs.map((l) => l.log_date).sort()

  return {
    experiment,
    logs,
    initial,
    deaths,
    alive: survivorCount(initial, deaths),
    rate: successRate(initial, deaths),
    daysToRoot: daysToStage(experiment, logs, reachedRoot),
    daysToLeaf: daysToStage(experiment, logs, reachedShoot),
    snapshot: stageSnapshot(logs, initial),
    lastLogDate: dates.length > 0 ? dates[dates.length - 1] : null,
  }
}

/** Group logs by experiment and summarise each, ordered as `experiments` is. */
export function summariseAll(
  experiments: Experiment[],
  logs: SummaryLog[],
): ExperimentSummary[] {
  const byExp = new Map<string, SummaryLog[]>()
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
  logs: Pick<DateLog, 'log_date' | 'deaths_count'>[],
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
  // The start point is pushed first but carries `started_on`, which a back-dated
  // log entry can sit before; sorting keeps the chart's path from doubling back.
  return points.sort((a, b) => a.t - b.t)
}
