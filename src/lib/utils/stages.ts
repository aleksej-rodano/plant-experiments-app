import type { DateLog, Experiment } from '../../types/database'
import { dayMs } from './chart'

/**
 * The columns of a log row the stage maths reads — nothing else is touched, so
 * callers are free to fetch a projection instead of the whole row. Mirrors what
 * `survival.ts` already does for `deaths_count`.
 */
export type StageLog = Pick<
  DateLog,
  | 'log_date'
  | 'created_at'
  | 'deaths_count'
  | 'r0_count'
  | 'r1_count'
  | 'r2_count'
  | 's0_count'
  | 's1_count'
  | 's2_count'
  | 's3_count'
  | 'leafing_without_rooting'
>

const DAY = 86_400_000

/**
 * Two independent ordinal tracks recorded per check-in as *current* bucket
 * counts (they can go down if something dies back). Root and shoot progress
 * separately — a cutting can push a leaf before it roots, or the reverse.
 */
export const ROOT_STAGES = [
  { key: 'r0_count', code: 'R0', label: 'No root' },
  { key: 'r1_count', code: 'R1', label: 'Root initiation (<2 mm)' },
  { key: 'r2_count', code: 'R2', label: 'Root elongation (≥2 mm)' },
] as const

export const SHOOT_STAGES = [
  { key: 's0_count', code: 'S0', label: 'No new growth' },
  { key: 's1_count', code: 'S1', label: 'Bud / leaf emerging (closed)' },
  { key: 's2_count', code: 'S2', label: 'Leaf unfolded' },
  { key: 's3_count', code: 'S3', label: 'Established (multiple leaves)' },
] as const

type RootKey = (typeof ROOT_STAGES)[number]['key']
type ShootKey = (typeof SHOOT_STAGES)[number]['key']

const ROOT_KEYS = ROOT_STAGES.map((s) => s.key) as RootKey[]
const SHOOT_KEYS = SHOOT_STAGES.map((s) => s.key) as ShootKey[]

export interface StageEntry {
  /** [R0, R1, R2] */
  root: [number, number, number]
  /** [S0, S1, S2, S3] */
  shoot: [number, number, number, number]
  dead: number
  leafingWithoutRooting: number
  /** R0 + R1 + R2 */
  rootTotal: number
  /** S0 + S1 + S2 + S3 */
  shootTotal: number
}

/** Null when this check-in recorded no stage counts at all. */
export function stageEntry(log: StageLog): StageEntry | null {
  const hasRoot = ROOT_KEYS.some((k) => log[k] != null)
  const hasShoot = SHOOT_KEYS.some((k) => log[k] != null)
  if (!hasRoot && !hasShoot) return null

  const root = ROOT_KEYS.map((k) => log[k] ?? 0) as [number, number, number]
  const shoot = SHOOT_KEYS.map((k) => log[k] ?? 0) as [
    number,
    number,
    number,
    number,
  ]
  return {
    root,
    shoot,
    dead: log.deaths_count ?? 0,
    leafingWithoutRooting: log.leafing_without_rooting ?? 0,
    rootTotal: root[0] + root[1] + root[2],
    shootTotal: shoot[0] + shoot[1] + shoot[2] + shoot[3],
  }
}

export function hasStageData(log: StageLog): boolean {
  return stageEntry(log) !== null
}

/** Most recent check-in (by date, then insertion order) that carries stage counts. */
export function latestStageLog<T extends StageLog>(logs: T[]): T | null {
  const withStages = logs.filter(hasStageData)
  if (withStages.length === 0) return null
  return [...withStages].sort((a, b) =>
    a.log_date === b.log_date
      ? a.created_at < b.created_at
        ? 1
        : -1
      : a.log_date < b.log_date
        ? 1
        : -1,
  )[0]
}

export interface StageSnapshot {
  log: StageLog
  entry: StageEntry
  /** Plants the experiment started with — the % denominator, or null if unset. */
  started: number | null
  /** % of the started total in each root bucket, or null without a denominator. */
  rootPct: [number, number, number] | null
  shootPct: [number, number, number, number] | null
  /** (R1 + R2) / started */
  pctRooted: number | null
  /** (S1 + S2 + S3) / started */
  pctAnyShoot: number | null
  /** S3 / started */
  pctEstablished: number | null
  /** leafingWithoutRooting / started */
  pctLeafingWithoutRooting: number | null
}

export function stageSnapshot(
  logs: StageLog[],
  startedCount: number | null,
): StageSnapshot | null {
  const log = latestStageLog(logs)
  if (!log) return null
  const entry = stageEntry(log)!
  const d = startedCount && startedCount > 0 ? startedCount : null
  const pct = (n: number) => (d == null ? null : (n / d) * 100)
  const pctArr = <T extends number[]>(arr: T) =>
    d == null ? null : (arr.map((n) => (n / d) * 100) as unknown as T)

  return {
    log,
    entry,
    started: d,
    rootPct: pctArr([...entry.root] as [number, number, number]),
    shootPct: pctArr([...entry.shoot] as [number, number, number, number]),
    pctRooted: pct(entry.root[1] + entry.root[2]),
    pctAnyShoot: pct(entry.shoot[1] + entry.shoot[2] + entry.shoot[3]),
    pctEstablished: pct(entry.shoot[3]),
    pctLeafingWithoutRooting: pct(entry.leafingWithoutRooting),
  }
}

/**
 * Soft reconciliation checks — every message is a nudge to double-check entry,
 * never a reason to block saving. Lag between counting the two tracks is normal.
 *
 * `priorDeaths` is what earlier check-ins already recorded as lost. It has to be
 * part of the sum: the bucket counts are the *current* living population, so on
 * an experiment that started with 10 and lost 2 last week, this week's honest
 * entry is 8 in the buckets and 0 new deaths. Reconciling against this entry's
 * deaths alone would flag every check-in after the first loss.
 */
export function stageWarnings(
  entry: StageEntry,
  startedCount: number | null,
  priorDeaths = 0,
): string[] {
  const out: string[] = []
  const started = startedCount ?? null

  if (started != null) {
    const dead = entry.dead + priorDeaths
    const rootSum = entry.rootTotal + dead
    if (rootSum !== started) {
      out.push(
        `Root buckets + dead = ${rootSum}, but the experiment started with ${started}.`,
      )
    }
    const shootSum = entry.shootTotal + dead
    if (shootSum !== started) {
      out.push(
        `Shoot buckets + dead = ${shootSum}, but the experiment started with ${started}.`,
      )
    }
  }

  const cap = Math.min(
    entry.root[0],
    entry.shoot[1] + entry.shoot[2] + entry.shoot[3],
  )
  if (entry.leafingWithoutRooting > cap) {
    out.push(
      `Leafing-without-rooting is ${entry.leafingWithoutRooting}, above the ${cap} that R0 and shoot counts allow.`,
    )
  }
  return out
}

export interface StageTrendPoint {
  date: string
  root: [number, number, number]
  shoot: [number, number, number, number]
}

/** Stage distribution per check-in, oldest first — the input to the trend charts. */
export function stageTrend(logs: StageLog[]): StageTrendPoint[] {
  return logs
    .map((l) => {
      const e = stageEntry(l)
      return e ? { date: l.log_date, root: e.root, shoot: e.shoot } : null
    })
    .filter((p): p is StageTrendPoint => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Days from the experiment's start to the first check-in whose stage entry
 * satisfies `reached`. Null if it never has.
 */
export function daysToStage(
  experiment: Experiment,
  logs: StageLog[],
  reached: (entry: StageEntry) => boolean,
): number | null {
  const dates = logs
    .filter((l) => {
      const e = stageEntry(l)
      return e != null && reached(e)
    })
    .map((l) => l.log_date)
    .sort()
  if (dates.length === 0 || !experiment.started_on) return null
  const days = Math.round((dayMs(dates[0]) - dayMs(experiment.started_on)) / DAY)
  return Math.max(0, days)
}

export const reachedRoot = (e: StageEntry) => e.root[1] + e.root[2] > 0
export const reachedShoot = (e: StageEntry) =>
  e.shoot[1] + e.shoot[2] + e.shoot[3] > 0
export const reachedEstablished = (e: StageEntry) => e.shoot[3] > 0
