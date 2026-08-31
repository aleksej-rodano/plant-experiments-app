import { BarChart3, Loader2, Sprout, Timer, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { summariseAll, type ExperimentSummary } from '../lib/utils/insights'
import {
  SURVIVAL_TEXT_CLASS,
  SURVIVAL_TILE_CLASS,
  formatRate,
  survivalLevel,
} from '../lib/utils/survival'
import type { DateLog, Experiment, Folder } from '../types/database'

/** Middle value of a sorted copy; even counts take the lower of the two middles. */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

interface Group {
  /** Display text — the first spelling seen, not the normalised grouping key. */
  key: string
  plants: number
  alive: number
  experiments: number
  rate: number | null
}

/**
 * Roll summaries up by an arbitrary label (folder title, origin, …). Grouping is
 * case-insensitive so "WDWD" and "wdwd" count as one treatment, but the label
 * shown is the first spelling encountered rather than the lowercased key.
 */
function groupBy(
  summaries: ExperimentSummary[],
  label: (s: ExperimentSummary) => string | null,
): Group[] {
  const map = new Map<string, Group>()
  for (const s of summaries) {
    const raw = label(s)
    if (!raw || s.initial == null || s.initial <= 0) continue
    const key = raw.toLowerCase()
    const g = map.get(key) ?? {
      key: raw,
      plants: 0,
      alive: 0,
      experiments: 0,
      rate: null,
    }
    g.plants += s.initial
    g.alive += s.alive
    g.experiments += 1
    map.set(key, g)
  }
  return [...map.values()]
    .map((g) => ({ ...g, rate: g.plants > 0 ? g.alive / g.plants : null }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
}

function RateBar({ group }: { group: Group }) {
  const pct = Math.round((group.rate ?? 0) * 100)
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-on-surface">{group.key}</span>
        <span
          className={`shrink-0 font-medium ${
            SURVIVAL_TEXT_CLASS[survivalLevel(group.rate)]
          }`}
        >
          {formatRate(group.rate)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-on-surface-variant">
        {group.alive}/{group.plants} plants · {group.experiments} experiment
        {group.experiments === 1 ? '' : 's'}
      </span>
    </li>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Trophy
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg bg-surface-container p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-on-surface">
        <Icon className="size-4 text-on-surface-variant" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function StatsPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [logs, setLogs] = useState<DateLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 15000)
    try {
      // RLS scopes every table to the signed-in user, so plain selects are enough.
      const [folderRes, expRes, logRes] = await Promise.all([
        supabase
          .from('folders')
          .select()
          .is('deleted_at', null)
          .abortSignal(controller.signal),
        supabase
          .from('experiments')
          .select()
          .is('deleted_at', null)
          .abortSignal(controller.signal),
        supabase
          .from('date_logs')
          .select()
          .is('deleted_at', null)
          .abortSignal(controller.signal),
      ])
      if (folderRes.error) throw folderRes.error
      if (expRes.error) throw expRes.error
      if (logRes.error) throw logRes.error
      setFolders(folderRes.data ?? [])
      setExperiments(expRes.data ?? [])
      setLogs(logRes.data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load stats.',
      )
    } finally {
      clearTimeout(abortTimer)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summaries = useMemo(
    () => summariseAll(experiments, logs),
    [experiments, logs],
  )

  const overall = useMemo(() => {
    const plants = summaries.reduce((sum, s) => sum + (s.initial ?? 0), 0)
    const alive = summaries.reduce((sum, s) => sum + s.alive, 0)
    const rootDays = summaries
      .map((s) => s.daysToRoot)
      .filter((d): d is number => d != null)
    return {
      plants,
      alive,
      rate: plants > 0 ? alive / plants : null,
      medianDaysToRoot: median(rootDays),
      rootedCount: rootDays.length,
    }
  }, [summaries])

  const folderTitles = useMemo(
    () => new Map(folders.map((f) => [f.id, f.title])),
    [folders],
  )

  const byFolder = useMemo(
    () =>
      groupBy(summaries, (s) =>
        folderTitles.get(s.experiment.folder_id) ?? null,
      ),
    [summaries, folderTitles],
  )
  const byOrigin = useMemo(
    () =>
      groupBy(summaries, (s) => {
        const folder = folders.find((f) => f.id === s.experiment.folder_id)
        return s.experiment.origin?.trim() || folder?.origin?.trim() || null
      }),
    [summaries, folders],
  )
  const byTreatment = useMemo(
    () => groupBy(summaries, (s) => s.experiment.title.trim()),
    [summaries],
  )

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <section className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 font-medium underline"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  if (experiments.length === 0) {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-medium text-on-surface">Stats</h1>
        <div className="mt-4 rounded-lg bg-surface-container px-4 py-12 text-center">
          <BarChart3 className="mx-auto mb-3 size-8 text-on-surface-variant/50" />
          <p className="text-on-surface">Nothing to compare yet.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Stats appear once you have experiments with plant counts.{' '}
            <Link to="/experiments" className="underline">
              Go to folders
            </Link>
            .
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium text-on-surface">Stats</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Everything you've logged, across every folder.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div
          className={`rounded-lg px-3 py-2 ${
            SURVIVAL_TILE_CLASS[survivalLevel(overall.rate)]
          }`}
        >
          <dt className="flex items-center gap-1 text-xs">
            <Sprout className="size-3.5" />
            Overall survival
          </dt>
          <dd className="mt-0.5 text-lg font-medium">
            {overall.alive}
            <span className="text-sm font-normal">
              {' / '}
              {overall.plants} ({formatRate(overall.rate)})
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-surface-container px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
            <BarChart3 className="size-3.5" />
            Scope
          </dt>
          <dd className="mt-0.5 text-on-surface">
            {folders.length} folder{folders.length === 1 ? '' : 's'}
            <span className="text-xs text-on-surface-variant">
              {' '}
              · {experiments.length} experiment
              {experiments.length === 1 ? '' : 's'}
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-surface-container px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
            <Timer className="size-3.5" />
            Median days to root
          </dt>
          <dd className="mt-0.5 text-on-surface">
            {overall.medianDaysToRoot ?? '—'}
            {overall.rootedCount > 0 && (
              <span className="text-xs text-on-surface-variant">
                {' '}
                · from {overall.rootedCount} rooted
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {byTreatment.length >= 2 && (
          <Panel title="Survival by treatment" icon={Trophy}>
            <ul className="flex flex-col gap-3">
              {byTreatment.slice(0, 8).map((g) => (
                <RateBar key={g.key} group={g} />
              ))}
            </ul>
          </Panel>
        )}

        {byFolder.length >= 2 && (
          <Panel title="Survival by folder" icon={BarChart3}>
            <ul className="flex flex-col gap-3">
              {byFolder.slice(0, 8).map((g) => (
                <RateBar key={g.key} group={g} />
              ))}
            </ul>
          </Panel>
        )}

        {byOrigin.length >= 2 && (
          <Panel title="Survival by origin" icon={Sprout}>
            <ul className="flex flex-col gap-3">
              {byOrigin.slice(0, 8).map((g) => (
                <RateBar key={g.key} group={g} />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {byTreatment.length < 2 && byFolder.length < 2 && byOrigin.length < 2 && (
        <p className="mt-4 rounded-lg bg-surface-container px-3 py-6 text-center text-sm text-on-surface-variant">
          Breakdowns appear once you have at least two experiments with plant
          counts to compare.
        </p>
      )}
    </section>
  )
}
