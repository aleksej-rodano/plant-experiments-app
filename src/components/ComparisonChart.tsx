import {
  AXIS,
  GRID,
  LABEL,
  fmtDateMs,
  fmtTick,
  seriesColor,
  ticks,
} from '../lib/utils/chart'
import { survivalSeries } from '../lib/utils/insights'
import { stageSnapshot } from '../lib/utils/stages'
import type { DateLog, Experiment } from '../types/database'

interface Props {
  experiments: Experiment[]
  /** Every log across the folder; grouped by experiment internally. */
  logs: DateLog[]
}

interface Point {
  t: number
  value: number
}

interface Series {
  label: string
  color: string
  points: Point[]
}

// Wider than the single-experiment chart: these carry several lines at once.
const VW = 360
const VH = 200
const M = { top: 10, right: 12, bottom: 46, left: 40 }
const PW = VW - M.left - M.right
const PH = VH - M.top - M.bottom

function fmtPct(n: number | null) {
  return n == null ? '—' : `${Math.round(n)}%`
}

/** Latest stage snapshot per experiment, side by side. */
function SnapshotTable({ experiments, logs }: Props) {
  const byExp = new Map<string, DateLog[]>()
  for (const log of logs) {
    const list = byExp.get(log.experiment_id)
    if (list) list.push(log)
    else byExp.set(log.experiment_id, [log])
  }

  const rows = experiments
    .map((exp) => ({
      exp,
      snap: stageSnapshot(byExp.get(exp.id) ?? [], exp.plant_count ?? null),
    }))
    .filter((r): r is { exp: Experiment; snap: NonNullable<typeof r.snap> } =>
      Boolean(r.snap),
    )

  if (rows.length === 0) return null

  return (
    <figure className="min-w-0 overflow-x-auto rounded-lg bg-surface-container p-3">
      <figcaption className="mb-2 text-xs text-on-surface-variant">
        Latest snapshot — each experiment
      </figcaption>
      <table className="w-full text-left text-xs">
        <thead className="text-on-surface-variant">
          <tr>
            <th className="pb-1 pr-2 font-medium">Experiment</th>
            <th className="pb-1 px-2 font-medium">Rooted</th>
            <th className="pb-1 px-2 font-medium">Any shoot</th>
            <th className="pb-1 px-2 font-medium">Established</th>
            <th className="pb-1 pl-2 font-medium">Leaf, no root</th>
          </tr>
        </thead>
        <tbody className="text-on-surface">
          {rows.map(({ exp, snap }) => (
            <tr key={exp.id} className="border-t border-outline-variant">
              <td className="max-w-32 truncate py-1 pr-2">{exp.title}</td>
              <td className="px-2 py-1">{fmtPct(snap.pctRooted)}</td>
              <td className="px-2 py-1">{fmtPct(snap.pctAnyShoot)}</td>
              <td className="px-2 py-1">{fmtPct(snap.pctEstablished)}</td>
              <td className="py-1 pl-2">
                {snap.entry.leafingWithoutRooting}
                <span className="text-on-surface-variant">
                  {' '}
                  ({fmtPct(snap.pctLeafingWithoutRooting)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function MultiChart({
  series,
  title,
  unit,
  /** Pin the y-axis top (survival is always 0-100%). */
  fixedMax,
}: {
  series: Series[]
  title: string
  unit: string
  fixedMax?: number
}) {
  const withData = series.filter((s) => s.points.length > 0)
  if (withData.length === 0) return null

  const allT = withData.flatMap((s) => s.points.map((p) => p.t))
  const minX = Math.min(...allT)
  const maxX = Math.max(...allT)
  const spanX = maxX - minX || 1

  const allV = withData.flatMap((s) => s.points.map((p) => p.value))
  const minY = 0
  const maxY = fixedMax ?? Math.max(1, ...allV)
  const spanY = maxY - minY || 1

  const px = (t: number) => M.left + ((t - minX) / spanX) * PW
  const py = (v: number) => M.top + PH - ((v - minY) / spanY) * PH

  // A gridline per distinct date across every series, thinned when crowded.
  const xDates = [...new Set(allT)].sort((a, b) => a - b)
  const labelEvery = xDates.length > 10 ? 3 : xDates.length > 6 ? 2 : 1

  return (
    <figure className="min-w-0 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 text-xs text-on-surface-variant">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        role="img"
        aria-label={`${title} compared across ${withData.length} experiments`}
      >
        {ticks(minY, maxY, 4).map((v) => (
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

        {xDates.map((t, i) => {
          const x = px(t)
          const showLabel = i % labelEvery === 0 || i === xDates.length - 1
          return (
            <g key={t}>
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
                  {fmtDateMs(t)}
                </text>
              )}
            </g>
          )
        })}

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

        {withData.map((s) => (
          <g key={s.label}>
            {s.points.length > 1 && (
              <path
                d={s.points
                  .map(
                    (p, i) =>
                      `${i === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(
                        p.value,
                      ).toFixed(1)}`,
                  )
                  .join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
              />
            )}
            {/* Keyed by index, not date: two entries can share a log_date. */}
            {s.points.map((p, i) => (
              <circle
                key={`${p.t}-${i}`}
                cx={px(p.t)}
                cy={py(p.value)}
                r={2}
                fill={s.color}
              />
            ))}
          </g>
        ))}
      </svg>

      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {withData.map((s) => (
          <li
            key={s.label}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="truncate">
              {s.label}
              {unit && s.points.length > 0
                ? ` · ${s.points[s.points.length - 1].value}${unit}`
                : ''}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * The folder's experiments overlaid on shared axes — the side-by-side read on
 * which treatment is actually winning. Renders nothing until there are at least
 * two experiments with something to plot.
 */
export default function ComparisonChart({ experiments, logs }: Props) {
  if (experiments.length < 2) return null

  const byExp = new Map<string, DateLog[]>()
  for (const log of logs) {
    const list = byExp.get(log.experiment_id)
    if (list) list.push(log)
    else byExp.set(log.experiment_id, [log])
  }

  const build = (points: (expLogs: DateLog[], exp: Experiment) => Point[]) =>
    experiments.map((exp, i) => ({
      label: exp.title,
      color: seriesColor(i),
      points: points(byExp.get(exp.id) ?? [], exp),
    }))

  const survival = build((expLogs, exp) => survivalSeries(exp, expLogs))
  const hasSurvival = survival.some((s) => s.points.length > 0)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {hasSurvival && (
        <MultiChart
          series={survival}
          title="Survival (%)"
          unit="%"
          fixedMax={100}
        />
      )}
      <SnapshotTable experiments={experiments} logs={logs} />
    </div>
  )
}
