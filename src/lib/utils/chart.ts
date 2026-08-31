/** Geometry and formatting shared by the measurement and comparison charts. */

export const GRID = 'var(--color-outline-variant, #c2c9bd)'
export const AXIS = 'var(--color-outline, #72796f)'
export const LABEL = 'var(--color-on-surface-variant, #424940)'

/** An ISO `yyyy-mm-dd` as epoch ms, read as local midnight. */
export function dayMs(iso: string) {
  return new Date(`${iso}T00:00:00`).getTime()
}

export function fmtDate(iso: string) {
  return fmtDateMs(dayMs(iso))
}

/**
 * Format an epoch ms produced by `dayMs` (i.e. local midnight). Formatting the
 * timestamp directly avoids the day-shift you get from round-tripping a local
 * date back through `toISOString()`.
 */
export function fmtDateMs(t: number) {
  return new Date(t).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function fmtTick(v: number) {
  return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(1)
}

/** count + 1 evenly spaced values spanning [min, max]. */
export function ticks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min, max]
  return Array.from(
    { length: count + 1 },
    (_, i) => min + ((max - min) * i) / count,
  )
}

/**
 * Distinct line colours for comparing experiments side by side. Chosen to stay
 * apart for the most common red/green colour blindness, and to read on both the
 * light and dark surface containers.
 */
export const SERIES_COLORS = [
  '#1b5e20', // green
  '#1565c0', // blue
  '#ef6c00', // orange
  '#6a1b9a', // purple
  '#00838f', // teal
  '#c62828', // red
  '#4e342e', // brown
  '#37474f', // slate
]

export function seriesColor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
