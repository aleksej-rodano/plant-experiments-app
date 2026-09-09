/**
 * Calendar-date helpers. Everything here works in the user's **local** calendar.
 *
 * `new Date().toISOString().slice(0, 10)` looks like the same thing but yields
 * the UTC date, which is a different day for roughly half the world at any given
 * moment: 09:00 in Auckland is still "yesterday" in UTC, and 18:00 in California
 * is already "tomorrow". Log dates, care schedules and export stamps are all
 * calendar dates the user picked off a local clock, so they have to be read off
 * the local clock too.
 */

/** Format a Date as `yyyy-mm-dd` from its local parts. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's date as `yyyy-mm-dd`, local. */
export function today(): string {
  return isoDate(new Date())
}

/** An ISO `yyyy-mm-dd` shifted by `days`, local. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

/** An ISO `yyyy-mm-dd` as epoch ms, read as local midnight. */
export function dayMs(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime()
}

/** Whole days between two ISO `yyyy-mm-dd` dates, or null if either is missing. */
export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  // Round rather than floor: a DST change makes the span off by an hour.
  return Math.round((dayMs(to) - dayMs(from)) / 86_400_000)
}
