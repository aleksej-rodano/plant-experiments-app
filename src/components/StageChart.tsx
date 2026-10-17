import { AXIS, GRID, LABEL, dayMs, fmtDate, fmtTick } from '../lib/utils/chart'
import { ROOT_STAGES, SHOOT_STAGES, stageTrend } from '../lib/utils/stages'
import type { DateLog } from '../types/database'

interface Props {
  /**
   * Phase 1 check-ins. Each stage entry already counts the plants still in
   * Phase 1 on its date, so the bars shrink by themselves after a potting.
   */
  logs: DateLog[]
  /** Potting dates, drawn as a vertical line + label across the stage bars. */
  pottings?: { id: string; potted_on: string }[]
}

// viewBox units; the SVG scales to its container.
const VW = 320
const VH = 180
const M = { top: 10, right: 10, bottom: 44, left: 28 }
const PW = VW - M.left - M.right
const PH = VH - M.top - M.bottom

// The stacked-bar charts need a bit more left margin to fit y-axis counts.
const BAR_M = { ...M, left: 34 }
const BAR_PW = VW - BAR_M.left - BAR_M.right

// Darker = further along the track. Grey means "no progress yet" in both
// tracks; the leaf track then steps through a wide, high-contrast green ramp
// so adjacent stages stay easy to tell apart at a glance.
const ROOT_FILL = ['#cfd8dc', '#26a69a', '#00695c']
// Potting marker: a warm tone that none of the stage ramps use.
const MARKER = '#c2410c'
const SHOOT_FILL = ['#cfd8dc', '#a5d6a7', '#4caf50', '#1b5e20']

function StackedBars({
  trend,
  fills,
  codes,
  labels,
  title,
  pick,
  pottings = [],
}: {
  pottings?: { id: string; potted_on: string }[]
  trend: ReturnType<typeof stageTrend>
  fills: string[]
  codes: string[]
  labels: string[]
  title: string
  pick: (p: ReturnType<typeof stageTrend>[number]) => number[]
}) {
  if (trend.length === 0) return null

  const totals = trend.map((p) => pick(p).reduce((a, b) => a + b, 0))
  const maxTotal = Math.max(1, ...totals)
  // Whole-plant counts only — a fractional midpoint tick (e.g. "2.5") would be
  // meaningless here, so round instead of using evenly-spaced decimal ticks.
  const yTicks =
    maxTotal <= 1 ? [0, maxTotal] : [0, Math.round(maxTotal / 2), maxTotal]

  const n = trend.length
  const slot = BAR_PW / n
  const barW = Math.min(28, slot * 0.7)
  const labelEvery = n > 8 ? 3 : n > 5 ? 2 : 1

  // A potting dated D has already happened for check-ins dated D, so its line
  // sits in the gap before the first bar dated D or later (left edge when all
  // bars are later, right edge when all are earlier). Pottings that land in the
  // same gap stack their labels.
  const markers = [...new Set(pottings.map((p) => p.potted_on))]
    .sort()
    .map((date) => ({
      id: date,
      date,
      slot: trend.filter((t) => t.date < date).length,
    }))
  const stackAt = new Map<number, number>()
  const placed = markers.map((m) => {
    const k = stackAt.get(m.slot) ?? 0
    stackAt.set(m.slot, k + 1)
    return { ...m, k }
  })
  const topM = placed.length > 0 ? BAR_M.top + 6 + 8 * Math.max(...stackAt.values()) : BAR_M.top
  const PHl = VH - topM - BAR_M.bottom

  return (
    <figure className="min-w-0 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 text-xs text-on-surface-variant">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        role="img"
        aria-label={`${title} distribution across ${n} check-ins, in plant count`}
      >
        <line
          x1={BAR_M.left}
          y1={topM}
          x2={BAR_M.left}
          y2={topM + PHl}
          stroke={AXIS}
          strokeWidth={1}
        />
        <line
          x1={BAR_M.left}
          y1={topM + PHl}
          x2={BAR_M.left + BAR_PW}
          y2={topM + PHl}
          stroke={AXIS}
          strokeWidth={1}
        />
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={BAR_M.left}
              y1={topM + PHl - (v / maxTotal) * PHl}
              x2={BAR_M.left + BAR_PW}
              y2={topM + PHl - (v / maxTotal) * PHl}
              stroke={GRID}
              strokeWidth={0.5}
            />
            <text
              x={BAR_M.left - 4}
              y={topM + PHl - (v / maxTotal) * PHl}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={7}
              fill={LABEL}
            >
              {fmtTick(v)}
            </text>
          </g>
        ))}

        {placed.map((m) => {
          const x = BAR_M.left + m.slot * slot
          const anchorEnd = m.slot > n / 2
          return (
            <g key={m.id}>
              <line
                x1={x}
                y1={topM - 2}
                x2={x}
                y2={topM + PHl}
                stroke={MARKER}
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <text
                x={anchorEnd ? x - 2 : x + 2}
                y={topM - 4 - 8 * m.k}
                textAnchor={anchorEnd ? 'end' : 'start'}
                fontSize={7}
                fill={MARKER}
              >
                Potted {fmtDate(m.date)}
              </text>
            </g>
          )
        })}

        {trend.map((p, i) => {
          const counts = pick(p)
          const x = BAR_M.left + i * slot + (slot - barW) / 2
          let yTop = topM + PHl
          return (
            <g key={`${p.date}-${i}`}>
              {counts.map((c, li) => {
                const h = (c / maxTotal) * PHl
                yTop -= h
                return h > 0 ? (
                  <rect
                    key={li}
                    x={x}
                    y={yTop}
                    width={barW}
                    height={h}
                    fill={fills[li]}
                  />
                ) : null
              })}
              {(i % labelEvery === 0 || i === n - 1) && (
                <text
                  x={x + barW / 2}
                  y={topM + PHl + 10}
                  transform={`rotate(-45 ${x + barW / 2} ${topM + PHl + 10})`}
                  textAnchor="end"
                  fontSize={7}
                  fill={LABEL}
                >
                  {fmtDate(p.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {codes.map((code, i) => (
          <li
            key={code}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: fills[i] }}
            />
            <span className="font-medium text-on-surface">{code}</span>
            {labels[i]}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Running total of losses, oldest check-in first. */
function cumulativeDeaths(logs: DateLog[]) {
  const sorted = logs
    .filter((l) => (l.deaths_count ?? 0) > 0)
    .sort((a, b) => dayMs(a.log_date) - dayMs(b.log_date))
  const points: { date: string; value: number }[] = []
  let running = 0
  for (const l of sorted) {
    running += l.deaths_count ?? 0
    points.push({ date: l.log_date, value: running })
  }
  return points
}

function CumulativeDeaths({ logs }: Props) {
  const points = cumulativeDeaths(logs)
  if (points.length === 0) return null

  const running = points[points.length - 1].value
  const maxY = Math.max(1, running)
  const xs = points.map((p) => dayMs(p.date))
  const minX = Math.min(...xs)
  const spanX = Math.max(...xs) - minX || 1
  const px = (t: number) => M.left + ((t - minX) / spanX) * PW
  const py = (v: number) => M.top + PH - (v / maxY) * PH

  return (
    <figure className="min-w-0 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-xs text-on-surface-variant">
        <span>Dead plants (cumulative)</span>
        <span className="font-medium text-on-surface">{running}</span>
      </figcaption>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img">
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
        {points.length > 1 && (
          <path
            d={points
              .map(
                (p, i) =>
                  `${i === 0 ? 'M' : 'L'} ${px(dayMs(p.date)).toFixed(1)} ${py(
                    p.value,
                  ).toFixed(1)}`,
              )
              .join(' ')}
            fill="none"
            stroke="var(--color-error, #d32f2f)"
            strokeWidth={1.5}
          />
        )}
        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={px(dayMs(p.date))}
            cy={py(p.value)}
            r={2}
            fill="var(--color-error, #d32f2f)"
          />
        ))}
      </svg>
    </figure>
  )
}

/**
 * Stage distribution per check-in for both tracks (stacked bars), plus the
 * running total of losses. Renders nothing until a check-in carries stage counts
 * or a loss.
 */
export default function StageChart({ logs, pottings }: Props) {
  const trend = stageTrend(logs)
  const anyDeaths = logs.some((l) => (l.deaths_count ?? 0) > 0)
  if (trend.length === 0 && !anyDeaths) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StackedBars
        trend={trend}
        fills={ROOT_FILL}
        codes={ROOT_STAGES.map((s) => s.code)}
        labels={ROOT_STAGES.map((s) => s.label)}
        title="Root track"
        pick={(p) => p.root}
        pottings={pottings}
      />
      <StackedBars
        trend={trend}
        fills={SHOOT_FILL}
        codes={SHOOT_STAGES.map((s) => s.code)}
        labels={SHOOT_STAGES.map((s) => s.label)}
        title="Leaf track"
        pick={(p) => p.shoot}
        pottings={pottings}
      />
      <CumulativeDeaths logs={logs} />
    </div>
  )
}
