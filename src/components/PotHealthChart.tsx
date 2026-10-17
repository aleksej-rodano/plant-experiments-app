import { AXIS, GRID, LABEL, fmtDate, fmtTick } from '../lib/utils/chart'
import type { Phase2TrendPoint } from '../lib/utils/phase2Trend'

interface Props {
  trend: Phase2TrendPoint[]
}

// Same geometry as the Phase 1 stacked-bar charts in StageChart.
const VW = 320
const VH = 180
const M = { top: 10, right: 10, bottom: 44, left: 34 }
const PW = VW - M.left - M.right
const PH = VH - M.top - M.bottom

const HEALTH = [
  { key: 'good', label: 'Good', fill: '#2e7d32' },
  { key: 'ok', label: 'OK', fill: '#f9a825' },
  { key: 'poor', label: 'Poor', fill: '#c62828' },
] as const

const ALIVE_STROKE = 'var(--color-on-surface, #1a1c19)'

/**
 * Phase 2 health per check-in date: stacked good / ok / poor bars (each pot's
 * latest health count up to that date) with an "alive in pots" line over them.
 * Renders nothing until a pot has a health count or a loss.
 */
export default function PotHealthChart({ trend }: Props) {
  if (trend.length === 0) return null

  const maxY = Math.max(
    1,
    ...trend.map((p) => Math.max(p.good + p.ok + p.poor, p.alive)),
  )
  const yTicks = maxY <= 1 ? [0, maxY] : [0, Math.round(maxY / 2), maxY]
  const n = trend.length
  const slot = PW / n
  const barW = Math.min(28, slot * 0.7)
  const labelEvery = n > 8 ? 3 : n > 5 ? 2 : 1
  const py = (v: number) => M.top + PH - (v / maxY) * PH
  const cx = (i: number) => M.left + i * slot + slot / 2

  return (
    <figure className="min-w-0 rounded-lg bg-surface-container p-3">
      <figcaption className="mb-1 text-xs text-on-surface-variant">
        Health in pots
      </figcaption>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        role="img"
        aria-label={`Plant health in pots (good, ok, poor) and plants alive in pots across ${n} check-ins, in plant count`}
      >
        <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + PH} stroke={AXIS} strokeWidth={1} />
        <line x1={M.left} y1={M.top + PH} x2={M.left + PW} y2={M.top + PH} stroke={AXIS} strokeWidth={1} />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} y1={py(v)} x2={M.left + PW} y2={py(v)} stroke={GRID} strokeWidth={0.5} />
            <text x={M.left - 4} y={py(v)} textAnchor="end" dominantBaseline="middle" fontSize={7} fill={LABEL}>
              {fmtTick(v)}
            </text>
          </g>
        ))}

        {trend.map((p, i) => {
          const x = cx(i) - barW / 2
          let yTop = M.top + PH
          return (
            <g key={`${p.date}-${i}`}>
              {HEALTH.map((h) => {
                const height = (p[h.key] / maxY) * PH
                yTop -= height
                return height > 0 ? (
                  <rect key={h.key} x={x} y={yTop} width={barW} height={height} fill={h.fill} />
                ) : null
              })}
              {(i % labelEvery === 0 || i === n - 1) && (
                <text
                  x={cx(i)}
                  y={M.top + PH + 10}
                  transform={`rotate(-45 ${cx(i)} ${M.top + PH + 10})`}
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

        {n > 1 && (
          <path
            d={trend
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${cx(i).toFixed(1)} ${py(p.alive).toFixed(1)}`)
              .join(' ')}
            fill="none"
            stroke={ALIVE_STROKE}
            strokeWidth={1.5}
          />
        )}
        {trend.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={cx(i)}
            cy={py(p.alive)}
            r={2.5}
            fill={ALIVE_STROKE}
            stroke="var(--color-surface-container, #fff)"
            strokeWidth={1}
          />
        ))}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {HEALTH.map((h) => (
          <li key={h.key} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: h.fill }} />
            {h.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ backgroundColor: ALIVE_STROKE }} />
          Alive in pots
        </li>
      </ul>
    </figure>
  )
}
