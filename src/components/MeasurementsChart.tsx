import {
  AXIS,
  GRID,
  LABEL,
  dayMs,
  fmtDate,
  fmtTick,
  ticks,
} from '../lib/utils/chart'
import type { DateLog } from '../types/database'

interface Props {
  logs: DateLog[]
}

interface Point {
  t: number // log_date as epoch ms
  value: number
}

// All geometry is in viewBox units; the SVG scales uniformly to its container.
const VW = 320
const VH = 190
const M = { top: 10, right: 12, bottom: 46, left: 38 }
const PW = VW - M.left - M.right
const PH = VH - M.top - M.bottom

function toPoints(
  logs: DateLog[],
  pick: (log: DateLog) => number | null,
): Point[] {
  return logs
    .map((log) => {
      const value = pick(log)
      return value == null ? null : { t: dayMs(log.log_date), value }
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.t - b.t)
}

/**
 * Running total of plants lost, oldest log first. deaths_count is a per-entry
 * number, so only the cumulative view is meaningful here.
 */
function toCumulativeDeaths(logs: DateLog[]): Point[] {
  const sorted = logs
    .filter((l) => (l.deaths_count ?? 0) > 0)
    .sort((a, b) => dayMs(a.log_date) - dayMs(b.log_date))
  let running = 0
  return sorted.map((l) => {
    running += l.deaths_count ?? 0
    return { t: dayMs(l.log_date), value: running }
  })
}

function Chart({
  points,
  xDates,
  title,
  unit,
  color,
}: {
  points: Point[]
  /** Every log date, ascending — the shared x grid. */
  xDates: string[]
  title: string
  unit: string
  color: string
}) {
  if (points.length === 0 || xDates.length === 0) return null

  const xs = xDates.map(dayMs)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanX = maxX - minX || 1

  const ys = points.map((p) => p.value)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(minY + 1, ...ys)
  const spanY = maxY - minY || 1

  const px = (t: number) => M.left + ((t - minX) / spanX) * PW
  const py = (v: number) => M.top + PH - ((v - minY) / spanY) * PH

  const yTicks = ticks(minY, maxY, 4)
  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(p.value).toFixed(1)}`,
    )
    .join(' ')
  const last = points[points.length - 1]

  // Thin the date labels when there are many; keep a gridline for every date.
  const labelEvery = xDates.length > 10 ? 3 : xDates.length > 6 ? 2 : 1

  return (
    <figure className="min-w-0 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-xs text-on-surface-variant">
        <span>{title}</span>
        <span className="font-medium text-on-surface">
          {last.value}
          {unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        role="img"
        aria-label={`${title} over time, latest ${last.value}${unit}`}
      >
        {/* horizontal gridlines + y-axis labels */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={M.left}
              y1={py(v)}
              x2={M.left + PW}
              y2={py(v)}
              stroke={GRID}
              strokeWidth={0.5}
            />
            <text
              x={M.left - 5}
              y={py(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={8}
              fill={LABEL}
            >
              {fmtTick(v)}
            </text>
          </g>
        ))}

        {/* vertical gridline for every log date + (thinned) date labels */}
        {xDates.map((d, i) => {
          const x = px(dayMs(d))
          const showLabel = i % labelEvery === 0 || i === xDates.length - 1
          return (
            <g key={d}>
              <line
                x1={x}
                y1={M.top}
                x2={x}
                y2={M.top + PH}
                stroke={GRID}
                strokeWidth={0.5}
              />
              {showLabel && (
                <text
                  x={x}
                  y={M.top + PH + 7}
                  transform={`rotate(-45 ${x} ${M.top + PH + 7})`}
                  textAnchor="end"
                  fontSize={7}
                  fill={LABEL}
                >
                  {fmtDate(d)}
                </text>
              )}
            </g>
          )
        })}

        {/* axes */}
        <line
          x1={M.left}
          y1={M.top}
          x2={M.left}
          y2={M.top + PH}
          stroke={AXIS}
          strokeWidth={1}
        />
        <line
          x1={M.left}
          y1={M.top + PH}
          x2={M.left + PW}
          y2={M.top + PH}
          stroke={AXIS}
          strokeWidth={1}
        />

        {/* series */}
        {points.length > 1 && (
          <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
        )}
        {/* Keyed by index, not date: two entries can share a log_date. */}
        {points.map((p, i) => (
          <circle
            key={`${p.t}-${i}`}
            cx={px(p.t)}
            cy={py(p.value)}
            r={2}
            fill={color}
          />
        ))}
      </svg>
    </figure>
  )
}

/**
 * Small line charts over the log dates — root length, new-leaf count, and the
 * running total of dead plants — each with a labelled y-axis and a gridline for
 * every log date. Renders nothing until a log carries a measurement or a loss.
 */
export default function MeasurementsChart({ logs }: Props) {
  const roots = toPoints(logs, (l) => l.root_length_mm)
  const leaves = toPoints(logs, (l) => l.new_leaves)
  const deaths = toCumulativeDeaths(logs)

  if (roots.length === 0 && leaves.length === 0 && deaths.length === 0) {
    return null
  }

  const xDates = [...new Set(logs.map((l) => l.log_date))].sort()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {roots.length > 0 && (
        <Chart
          points={roots}
          xDates={xDates}
          title="Root length"
          unit=" mm"
          color="var(--color-primary, #1b5e20)"
        />
      )}
      {leaves.length > 0 && (
        <Chart
          points={leaves}
          xDates={xDates}
          title="New leaves"
          unit=""
          color="var(--color-secondary, #00897b)"
        />
      )}
      {deaths.length > 0 && (
        <Chart
          points={deaths}
          xDates={xDates}
          title="Dead plants (cumulative)"
          unit=""
          color="var(--color-error, #d32f2f)"
        />
      )}
    </div>
  )
}
