import type { DateLog } from '../../types/database'

/** Sum of plants lost across a set of log entries. */
export function totalDeaths(logs: Pick<DateLog, 'deaths_count'>[]): number {
  return logs.reduce((sum, log) => sum + (log.deaths_count ?? 0), 0)
}

/** Plants still alive: the initial count minus every death logged since. */
export function survivorCount(
  initialCount: number | null | undefined,
  deaths: number,
): number {
  if (initialCount == null) return 0
  return Math.max(0, initialCount - deaths)
}

/** survivors / initial, or null when there's no initial count to divide by. */
export function successRate(
  initialCount: number | null | undefined,
  deaths: number,
): number | null {
  if (!initialCount || initialCount <= 0) return null
  return survivorCount(initialCount, deaths) / initialCount
}

export function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

/**
 * Coarse survival band for a rate in 0..1 (or null when there's nothing to divide by).
 * Thresholds: >=80% healthy, 50–79% watch, 25–49% poor, <25% critical.
 */
export type SurvivalLevel = 'none' | 'high' | 'mid' | 'low' | 'critical'

export function survivalLevel(rate: number | null): SurvivalLevel {
  if (rate == null) return 'none'
  const pct = rate * 100
  if (pct >= 80) return 'high'
  if (pct >= 50) return 'mid'
  if (pct >= 25) return 'low'
  return 'critical'
}

/** Text colour for an "x/y alive" readout, keyed by survival band. */
export const SURVIVAL_TEXT_CLASS: Record<SurvivalLevel, string> = {
  none: 'text-on-surface-variant',
  high: 'text-green-700',
  mid: 'text-yellow-700',
  low: 'text-orange-700',
  critical: 'text-red-600',
}

/** Filled-tile colour (background + text) for the prominent survival stat. */
export const SURVIVAL_TILE_CLASS: Record<SurvivalLevel, string> = {
  none: 'bg-surface-container text-on-surface',
  high: 'bg-green-100 text-green-900',
  mid: 'bg-yellow-100 text-yellow-900',
  low: 'bg-orange-100 text-orange-900',
  critical: 'bg-red-100 text-red-900',
}

/** Common causes offered as autocomplete suggestions on the log form. */
export const DEATH_CAUSE_SUGGESTIONS = [
  'Rot',
  'Mould',
  'Pests',
  'Dehydration',
  'Overwatering',
  'Physical damage',
  'Transplant shock',
  'Unknown',
]
