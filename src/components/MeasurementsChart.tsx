import type { DateLog } from '../types/database'

interface Props {
  logs: DateLog[]
}

interface Point {
  t: number // log_date as epoch ms, for x positioning
  value: number
  label: string
}

const W = 320
const H = 96
const PAD = 6

function toPoints(
  logs: DateLog[],
  pick: (log: DateLog) => number | null,
): Point[] {
  return logs
    .map((log) => {
      const value = pick(log)
      if (value == null) return null
      return {
        t: new Date(`${log.log_date}T00:00:00`).getTime(),
        value,
        label: log.log_date,
      }
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.t - b.t)
}

function Sparkline({
  points,
  title,
  unit,
  color,
}: {
  points: Point[]
  title: string
  unit: string
  color: string
}) {
  if (points.length === 0) return null

  const xs = points.map((p) => p.t)
  const ys = points.map((p) => p.value)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1

  const px = (t: number) => PAD + ((t - minX) / spanX) * (W - PAD * 2)
  const py = (v: number) => H - PAD - ((v - minY) / spanY) * (H - PAD * 2)

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(p.value).toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]

  return (
    <figure className="min-w-0 flex-1 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-xs text-on-surface-variant">
        <span>{title}</span>
        <span className="font-medium text-on-surface">
          {last.value}
          {unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title} over time, latest ${last.value}${unit}`}
      >
        {points.length > 1 && (
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map((p) => (
          <circle
            key={p.t}
            cx={px(p.t)}
            cy={py(p.value)}
            r={2.5}
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </figure>
  )
}

/**
 * Two tiny line charts — root length and new-leaf count over the log dates.
 * Renders nothing until at least one log carries a measurement.
 */
export default function MeasurementsChart({ logs }: Props) {
  const roots = toPoints(logs, (l) => l.root_length_mm)
  const leaves = toPoints(logs, (l) => l.new_leaves)

  if (roots.length === 0 && leaves.length === 0) return null

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Sparkline
        points={roots}
        title="Root length"
        unit=" mm"
        color="var(--color-primary, #1b5e20)"
      />
      <Sparkline
        points={leaves}
        title="New leaves"
        unit=""
        color="var(--color-secondary, #00897b)"
      />
    </div>
  )
}
