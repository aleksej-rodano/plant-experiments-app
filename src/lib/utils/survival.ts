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
