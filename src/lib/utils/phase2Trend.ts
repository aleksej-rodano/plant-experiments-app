import type { DateLog, Pot } from '../../types/database'
import { phase2Alive, type PhaseInput } from './phases'

export interface Phase2TrendPoint {
  date: string
  good: number
  ok: number
  poor: number
  /** Plants alive across all pots potted on or before `date`. */
  alive: number
}

const hasHealth = (l: DateLog) =>
  l.health_good != null || l.health_ok != null || l.health_poor != null

/**
 * Phase 2 health per check-in date, oldest first (input to the Phase 2 chart).
 *
 * A point exists for every date on which a pot got a health count or lost
 * plants. Its good / ok / poor are the sum, over the pots potted by then, of each
 * pot's LATEST health log dated on or before that date (a pot with no health log
 * yet adds nothing). `alive` is `phase2Alive` on that date.
 */
export function phase2Trend(
  input: PhaseInput,
  logs: DateLog[],
  pots: Pot[],
): Phase2TrendPoint[] {
  const pottedOn = new Map<string, string>()
  for (const p of input.pottings) {
    if (!p.deleted_at) pottedOn.set(p.id, p.potted_on)
  }
  const potDate = new Map<string, string>()
  for (const pot of pots) {
    const d = pottedOn.get(pot.potting_id)
    if (!pot.deleted_at && d != null) potDate.set(pot.id, d)
  }

  const potted = logs.filter(
    (l) =>
      !l.deleted_at &&
      l.phase === 'potted' &&
      l.pot_id != null &&
      potDate.has(l.pot_id),
  )

  // Per pot, health logs oldest first (same-day ties by insertion order).
  const healthByPot = new Map<string, DateLog[]>()
  for (const l of potted.filter(hasHealth)) {
    const list = healthByPot.get(l.pot_id!) ?? []
    list.push(l)
    healthByPot.set(l.pot_id!, list)
  }
  for (const list of healthByPot.values()) {
    list.sort((a, b) =>
      a.log_date === b.log_date
        ? a.created_at.localeCompare(b.created_at)
        : a.log_date.localeCompare(b.log_date),
    )
  }

  const dates = [
    ...new Set(
      potted
        .filter((l) => hasHealth(l) || (l.deaths_count ?? 0) > 0)
        .map((l) => l.log_date),
    ),
  ].sort()

  return dates.map((date) => {
    let good = 0
    let ok = 0
    let poor = 0
    for (const [potId, list] of healthByPot) {
      if ((potDate.get(potId) ?? '') > date) continue
      let latest: DateLog | null = null
      for (const l of list) if (l.log_date <= date) latest = l
      if (!latest) continue
      good += latest.health_good ?? 0
      ok += latest.health_ok ?? 0
      poor += latest.health_poor ?? 0
    }
    return { date, good, ok, poor, alive: phase2Alive(input, date) }
  })
}
