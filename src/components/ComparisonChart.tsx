import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
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
import { stageDelta, stagePctSeries, stageSnapshot } from '../lib/utils/stages'
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
  /** SVG `stroke-dasharray`; omit for a solid line. */
  dash?: string
  points: Point[]
}

type StageKey = 'rooted' | 'shoots' | 'established'

const STAGE_META: { key: StageKey; label: string; dash?: string }[] = [
  { key: 'rooted', label: 'Rooted' },
  { key: 'shoots', label: 'Shoots', dash: '5 3' },
  { key: 'established', label: 'Established', dash: '1 2' },
]

// Wider than the single-experiment chart: these carry several lines at once.
const VW = 360
const VH = 200
const M = { top: 10, right: 12, bottom: 46, left: 40 }
const PW = VW - M.left - M.right
const PH = VH - M.top - M.bottom

function fmtPct(n: number | null) {
  return n == null ? '—' : `${Math.round(n)}%`
}

/** Percentage-point change since the previous check-in, or null without one. */
function pctDelta(countDelta: number | null, denom: number | null) {
  if (countDelta == null || !denom) return null
  return Math.round((countDelta / denom) * 100)
}

/** A percentage plus a small trend arrow showing the move since last check-in. */
function TrendCell({
  value,
  delta,
}: {
  value: number | null
  delta: number | null
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {fmtPct(value)}
      {delta != null && delta !== 0 && (
        <span
          className={`inline-flex items-center ${
            delta > 0 ? 'text-green-700' : 'text-red-600'
          }`}
          title={`${delta > 0 ? '+' : ''}${delta}pp since previous check-in`}
        >
          {delta > 0 ? (
            <ArrowUp className="size-2.5" />
          ) : (
            <ArrowDown className="size-2.5" />
          )}
          {Math.abs(delta)}
        </span>
      )}
    </span>
  )
}

/** Latest stage snapshot per experiment, side by side, with trend vs. the
 * previous check-in so a bare percentage doesn't have to speak for itself. */
function SnapshotTable({ experiments, logs }: Props) {
  const byExp = new Map<string, DateLog[]>()
  for (const log of logs) {
    const list = byExp.get(log.experiment_id)
    if (list) list.push(log)
    else byExp.set(log.experiment_id, [log])
  }

  const rows = experiments
    .map((exp) => {
      const expLogs = byExp.get(exp.id) ?? []
      const denom = exp.plant_count ?? null
      return {
        exp,
        snap: stageSnapshot(expLogs, denom),
        delta: stageDelta(expLogs),
        denom,
      }
    })
    .filter(
      (
        r,
      ): r is {
        exp: Experiment
        snap: NonNullable<typeof r.snap>
        delta: NonNullable<typeof r.delta>
        denom: number | null
      } => Boolean(r.snap) && Boolean(r.delta),
    )

  if (rows.length === 0) return null

  return (
    <figure className="min-w-0 overflow-x-auto rounded-lg bg-surface-container p-3">
      <figcaption className="mb-2 text-xs text-on-surface-variant">
        Latest snapshot — each experiment, vs. its previous check-in
      </figcaption>
      <table className="w-full text-left text-xs">
        <thead className="text-on-surface-variant">
          <tr>
            <th className="pb-1 pr-2 font-medium">Experiment</th>
            <th className="pb-1 px-2 font-medium">Rooted</th>
            <th className="pb-1 px-2 font-medium">Any shoot</th>
            <th className="pb-1 px-2 font-medium">Established</th>
          </tr>
        </thead>
        <tbody className="text-on-surface">
          {rows.map(({ exp, snap, delta, denom }) => (
            <tr key={exp.id} className="border-t border-outline-variant">
              <td className="max-w-32 truncate py-1 pr-2">{exp.title}</td>
              <td className="px-2 py-1">
                <TrendCell
                  value={snap.pctRooted}
                  delta={pctDelta(delta.rootedDelta, denom)}
                />
              </td>
              <td className="px-2 py-1">
                <TrendCell
                  value={snap.pctAnyShoot}
                  delta={pctDelta(delta.leafDelta, denom)}
                />
              </td>
              <td className="px-2 py-1">
                <TrendCell
                  value={snap.pctEstablished}
                  delta={pctDelta(delta.establishedDelta, denom)}
                />
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
                strokeDasharray={s.dash}
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
            <svg width="14" height="8" aria-hidden className="shrink-0">
              <line
                x1={0}
                y1={4}
                x2={14}
                y2={4}
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray={s.dash}
              />
            </svg>
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
 * Rooted / Shoots / Established, all on one chart — same color per experiment
 * as the survival chart, distinguished by line style, with checkboxes to
 * toggle each stage on or off.
 */
function StageComparisonChart({ experiments, logs }: Props) {
  const [enabled, setEnabled] = useState<Record<StageKey, boolean>>({
    rooted: true,
    shoots: true,
    established: true,
  })

  const byExp = new Map<string, DateLog[]>()
  for (const log of logs) {
    const list = byExp.get(log.experiment_id)
    if (list) list.push(log)
    else byExp.set(log.experiment_id, [log])
  }

  const series: Series[] = []
  experiments.forEach((exp, i) => {
    const pct = stagePctSeries(byExp.get(exp.id) ?? [], exp.plant_count ?? null)
    const byStage: Record<StageKey, Point[]> = {
      rooted: pct.rooted,
      shoots: pct.anyShoot,
      established: pct.established,
    }
    for (const { key, label, dash } of STAGE_META) {
      if (!enabled[key]) continue
      series.push({
        label: `${exp.title} · ${label}`,
        color: seriesColor(i),
        dash,
        points: byStage[key],
      })
    }
  })

  const hasData = series.some((s) => s.points.length > 0)

  return (
    <div className="min-w-0 sm:col-span-2">
      <div className="mb-2 flex flex-wrap gap-3 rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">
        {STAGE_META.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={enabled[key]}
              onChange={() =>
                setEnabled((prev) => ({ ...prev, [key]: !prev[key] }))
              }
            />
            {label}
          </label>
        ))}
        {!hasData && <span>Nothing to show — tick at least one stage.</span>}
      </div>
      {hasData && (
        <MultiChart
          series={series}
          title="Stage progress (%)"
          unit="%"
          fixedMax={100}
        />
      )}
    </div>
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
      <StageComparisonChart experiments={experiments} logs={logs} />
    </div>
  )
}
