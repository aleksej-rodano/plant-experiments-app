import { stageDelta, stageSnapshot } from '../lib/utils/stages'
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

function fmtSigned(n: number) {
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * The most recent stage tally for one experiment: current totals for both
 * tracks, plus what changed since the previous check-in. The full history
 * is already in the chart below this, so this only calls out what's new.
 */
export default function StageSnapshot({ logs, startedCount }: Props) {
  const snap = stageSnapshot(logs, startedCount)
  const delta = stageDelta(logs)
  if (!snap || !delta) return null

  const { entry } = snap
  const rooted = entry.root[1] + entry.root[2]
  const leafing = entry.shoot[1] + entry.shoot[2] + entry.shoot[3]
  const established = entry.shoot[3]

  const changeParts = delta.previousLog
    ? [
        `${fmtSigned(delta.rootedDelta ?? 0)} rooted`,
        `${fmtSigned(delta.leafDelta ?? 0)} leafing`,
        `${fmtSigned(delta.establishedDelta ?? 0)} established`,
        `${fmtSigned(-delta.deathsSincePrevious)} died`,
      ]
    : null

  return (
    <section className="rounded-lg bg-surface-container p-3">
      <h3 className="mb-2 text-sm font-medium text-on-surface">
        Latest check-in
        <span className="ml-1 font-normal text-on-surface-variant">
          · {formatLogDate(snap.log.log_date)}
        </span>
      </h3>

      <p className="text-sm text-on-surface">
        {rooted}
        {snap.started != null && `/${snap.started}`} rooted
        {snap.pctRooted != null && ` (${pct(snap.pctRooted)})`}
        {' · '}
        {leafing}
        {snap.started != null && `/${snap.started}`} leafing
        {snap.pctAnyShoot != null && ` (${pct(snap.pctAnyShoot)})`}
        {' · '}
        {established}
        {snap.started != null && `/${snap.started}`} established
        {snap.pctEstablished != null && ` (${pct(snap.pctEstablished)})`}
      </p>

      <p className="mt-1 text-xs text-on-surface-variant">
        {changeParts ? (
          <>
            Since {formatLogDate(delta.previousLog!.log_date)}
            {delta.daysSincePrevious != null &&
              ` (${delta.daysSincePrevious}d ago)`}
            : {changeParts.join(' · ')}
          </>
        ) : (
          'First check-in with stage counts recorded.'
        )}
      </p>
    </section>
  )
}
