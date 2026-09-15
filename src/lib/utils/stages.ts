import type { DateLog, Experiment } from '../../types/database'
import { dayMs } from './chart'

const DAY = 86_400_000

/**
 * Two independent ordinal tracks recorded per check-in as *current* bucket
 * counts (they can go down if something dies back). Root and shoot progress
 * separately — a cutting can push a leaf before it roots, or the reverse.
 */
export const ROOT_STAGES = [
  { key: 'r0_count', code: 'R0', label: 'No root' },
  { key: 'r1_count', code: 'R1', label: 'Root initiation (<5 mm)' },
  { key: 'r2_count', code: 'R2', label: 'Root elongation (≥5 mm)' },
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
export function stageEntry(log: DateLog): StageEntry | null {
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

export function hasStageData(log: DateLog): boolean {
  return stageEntry(log) !== null
}

/** Most recent check-in (by date, then insertion order) that carries stage counts. */
export function latestStageLog(logs: DateLog[]): DateLog | null {
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
  log: DateLog
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
  logs: DateLog[],
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
 */
export function stageWarnings(
  entry: StageEntry,
  startedCount: number | null,
): string[] {
  const out: string[] = []
  const started = startedCount ?? null

  if (started != null) {
    const rootSum = entry.rootTotal + entry.dead
    if (rootSum !== started) {
      out.push(
        `Root buckets + dead = ${rootSum}, but the experiment started with ${started}.`,
      )
    }
    const shootSum = entry.shootTotal + entry.dead
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
export function stageTrend(logs: DateLog[]): StageTrendPoint[] {
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
  logs: DateLog[],
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

export interface StagePctPoint {
  t: number
  value: number
}

/**
 * % rooted / % any-shoot / % established at each check-in, oldest first — the
 * input to the per-stage comparison charts. Empty without a plant count to
 * divide by. One point per date: a later entry on the same day supersedes the
 * earlier, same tie-break as `latestStageLog`.
 */
export function stagePctSeries(
  logs: DateLog[],
  startedCount: number | null,
): {
  rooted: StagePctPoint[]
  anyShoot: StagePctPoint[]
  established: StagePctPoint[]
} {
  const empty = { rooted: [], anyShoot: [], established: [] }
  const d = startedCount && startedCount > 0 ? startedCount : null
  if (d == null) return empty

  const withStages = logs
    .map((log) => ({ log, entry: stageEntry(log) }))
    .filter((x): x is { log: DateLog; entry: StageEntry } => x.entry !== null)
    .sort((a, b) =>
      a.log.log_date === b.log.log_date
        ? a.log.created_at < b.log.created_at
          ? -1
          : 1
        : a.log.log_date < b.log.log_date
          ? -1
          : 1,
    )

  const rooted: StagePctPoint[] = []
  const anyShoot: StagePctPoint[] = []
  const established: StagePctPoint[] = []
  const push = (arr: StagePctPoint[], t: number, value: number) => {
    const existing = arr.findIndex((p) => p.t === t)
    if (existing >= 0) arr[existing] = { t, value }
    else arr.push({ t, value })
  }
  for (const { log, entry } of withStages) {
    const t = dayMs(log.log_date)
    push(rooted, t, ((entry.root[1] + entry.root[2]) / d) * 100)
    push(
      anyShoot,
      t,
      ((entry.shoot[1] + entry.shoot[2] + entry.shoot[3]) / d) * 100,
    )
    push(established, t, (entry.shoot[3] / d) * 100)
  }
  return { rooted, anyShoot, established }
}
