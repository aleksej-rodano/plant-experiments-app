import { TriangleAlert } from 'lucide-react'
import { ROOT_STAGES, SHOOT_STAGES, stageSnapshot } from '../lib/utils/stages'
import type { DateLog } from '../types/database'

interface Props {
  logs: DateLog[]
  /** Plants the experiment started with — the percentage denominator. */
  startedCount: number | null
}

function formatLogDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function pct(n: number | null) {
  return n == null ? '—' : `${Math.round(n)}%`
}

function StageRow({
  codes,
  counts,
  percents,
}: {
  codes: readonly string[]
  counts: number[]
  percents: number[] | null
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
      {codes.map((code, i) => (
        <div
          key={code}
          className="rounded-lg bg-surface px-2 py-1.5 text-center"
        >
          <div className="text-xs font-medium text-on-surface-variant">
            {code}
          </div>
          <div className="text-sm text-on-surface">
            {counts[i]}
            {percents && (
              <span className="text-xs text-on-surface-variant">
                {' '}
                ({pct(percents[i])})
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The most recent stage tally for one experiment: exact bucket counts +
 * percentages for both tracks, the cumulative-progress read, and the
 * leafing-without-rooting flag called out on its own.
 */
export default function StageSnapshot({ logs, startedCount }: Props) {
  const snap = stageSnapshot(logs, startedCount)
  if (!snap) return null

  const { entry, rootPct, shootPct } = snap
  const denom = snap.started

  return (
    <section className="rounded-lg bg-surface-container p-3">
      <h3 className="mb-2 text-sm font-medium text-on-surface">
        Latest check-in
        <span className="ml-1 font-normal text-on-surface-variant">
          · {formatLogDate(snap.log.log_date)}
        </span>
      </h3>

      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-xs text-on-surface-variant">Root track</div>
          <StageRow
            codes={ROOT_STAGES.map((s) => s.code)}
            counts={entry.root}
            percents={rootPct}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-on-surface-variant">
            Shoot / leaf track
          </div>
          <StageRow
            codes={SHOOT_STAGES.map((s) => s.code)}
            counts={entry.shoot}
            percents={shootPct}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Rooted (R≥1)', value: snap.pctRooted },
            { label: 'Any shoot (S≥1)', value: snap.pctAnyShoot },
            { label: 'Established (S3)', value: snap.pctEstablished },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-surface px-2 py-1.5">
              <dt className="text-xs text-on-surface-variant">{m.label}</dt>
              <dd className="text-sm font-medium text-on-surface">
                {pct(m.value)}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            entry.leafingWithoutRooting > 0
              ? 'bg-error-container text-on-error-container'
              : 'bg-surface text-on-surface-variant'
          }`}
        >
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            Leafing without rooting:{' '}
            <span className="font-medium">{entry.leafingWithoutRooting}</span>
            {denom != null && ` / ${denom} (${pct(snap.pctLeafingWithoutRooting)})`}
          </span>
        </div>
      </div>
    </section>
  )
}
