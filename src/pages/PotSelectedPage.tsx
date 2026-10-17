import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PotRowsEditor from '../components/PotRowsEditor'
import { useAuth } from '../lib/hooks/useAuth'
import { usePottings } from '../lib/hooks/usePottings'
import { supabase } from '../lib/supabase'
import { today } from '../lib/utils/care'
import {
  groupByExperiment,
  phase1Cohort,
  phase1Spare,
  readyToPot,
  type PhaseInput,
} from '../lib/utils/phases'
import {
  newPotRow,
  plantsLabel,
  potsLabel,
  savePotting,
  validatePotRows,
  type PotRowDraft,
} from '../lib/utils/potting'
import { stageSnapshot } from '../lib/utils/stages'
import type { DateLog, Experiment, Folder } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

/** An experiment that was potted successfully in this session of the wizard. */
interface Done {
  id: string
  title: string
  plants: number
  pots: number
}

function BackLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant"
    >
      <ArrowLeft className="size-4" />
      Back
    </Link>
  )
}

export default function PotSelectedPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const [params] = useSearchParams()
  const location = useLocation()
  const seededFolder =
    (location.state as { folder?: Folder } | null)?.folder ?? null

  const backTo = folderId ? `/folders/${folderId}` : '/experiments'
  const idsKey = params.get('ids') ?? ''
  const ids = useMemo(
    () => [...new Set(idsKey.split(',').map((s) => s.trim()).filter(Boolean))],
    [idsKey],
  )

  const [folder, setFolder] = useState<Folder | null>(seededFolder)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [logs, setLogs] = useState<DateLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pottings, pots, loading: pottingsLoading } = usePottings(ids)

  useEffect(() => {
    if (!folderId || ids.length === 0) {
      setDataLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const [folderRes, expRes, logRes] = await Promise.all([
        supabase
          .from('folders')
          .select()
          .eq('id', folderId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('experiments')
          .select()
          .eq('folder_id', folderId)
          .in('id', ids)
          .is('deleted_at', null),
        supabase
          .from('date_logs')
          .select()
          .in('experiment_id', ids)
          .is('deleted_at', null)
          .order('log_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      if (folderRes.error) setError(folderRes.error.message)
      else if (!folderRes.data) setError('Folder not found.')
      else setFolder(folderRes.data)
      if (expRes.error) setError(expRes.error.message)
      else {
        // Keep the order the user ticked them in.
        const byId = new Map((expRes.data ?? []).map((e) => [e.id, e]))
        setExperiments(ids.flatMap((id) => byId.get(id) ?? []))
      }
      if (logRes.error) setError(logRes.error.message)
      else setLogs(logRes.data ?? [])
      setDataLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [folderId, ids])

  if (dataLoading || pottingsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !folder || experiments.length === 0) {
    return (
      <section className="mx-auto max-w-lg">
        <BackLink to={backTo} />
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error ??
            (ids.length === 0
              ? 'No experiments selected. Go back and tick the experiments to pot.'
              : 'None of the selected experiments were found.')}
        </p>
      </section>
    )
  }

  return (
    <PotSelectedForm
      folder={folder}
      experiments={experiments}
      logs={logs}
      pottings={pottings}
      pots={pots}
      backTo={backTo}
    />
  )
}

type Pottings = ReturnType<typeof usePottings>['pottings']
type Pots = ReturnType<typeof usePottings>['pots']

function PotSelectedForm({
  folder,
  experiments,
  logs,
  pottings,
  pots,
  backTo,
}: {
  folder: Folder
  experiments: Experiment[]
  logs: DateLog[]
  pottings: Pottings
  pots: Pots
  backTo: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [pottedOn, setPottedOn] = useState(today())
  const [sharedSize, setSharedSize] = useState('')
  const [sharedSubstrate, setSharedSubstrate] = useState('')
  const [sharedNotes, setSharedNotes] = useState('')

  // Pot numbering continues from the pots an experiment already has.
  const firstNumbers = useMemo(() => {
    const byExp = groupByExperiment(pots)
    return new Map(experiments.map((e) => [e.id, (byExp.get(e.id)?.length ?? 0) + 1]))
  }, [experiments, pots])

  const [drafts, setDrafts] = useState<Record<string, PotRowDraft[]>>(() =>
    Object.fromEntries(
      experiments.map((e) => [e.id, [newPotRow(firstNumbers.get(e.id) ?? 1)]]),
    ),
  )
  // Experiments still to pot (succeeded ones leave the form).
  const [pendingIds, setPendingIds] = useState<string[]>(() =>
    experiments.map((e) => e.id),
  )
  const [done, setDone] = useState<Done[]>([])
  const [failures, setFailures] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Per-experiment Phase 1 figures, built once from the folder-wide rows.
  const info = useMemo(() => {
    const logsBy = groupByExperiment(logs)
    const pottingsBy = groupByExperiment(pottings)
    const potsBy = groupByExperiment(pots)
    return new Map(
      experiments.map((exp) => {
        const expLogs = logsBy.get(exp.id) ?? []
        const input: PhaseInput = {
          experiment: exp,
          pottings: pottingsBy.get(exp.id) ?? [],
          pots: potsBy.get(exp.id) ?? [],
          logs: expLogs,
        }
        const phase1Logs = expLogs.filter((l) => l.phase !== 'potted')
        const snap = stageSnapshot(phase1Logs, (asOf) =>
          phase1Cohort(input, asOf),
        )
        return [exp.id, { available: phase1Spare(input), ready: readyToPot(snap) }]
      }),
    )
  }, [experiments, logs, pottings, pots])

  const pending = experiments.filter((e) => pendingIds.includes(e.id))

  /** Copy a shared value into the matching field of every pot row still to save. */
  function applyShared(field: 'size' | 'substrate' | 'notes', value: string) {
    setDrafts((prev) => {
      const next: Record<string, PotRowDraft[]> = { ...prev }
      for (const id of pendingIds) {
        next[id] = (prev[id] ?? []).map((r) => ({ ...r, [field]: value }))
      }
      return next
    })
  }

  /** Rows the user adds later start with the shared values, still editable. */
  function setRows(expId: string, rows: PotRowDraft[]) {
    const before = new Set((drafts[expId] ?? []).map((r) => r.key))
    setDrafts((prev) => ({
      ...prev,
      [expId]: rows.map((r) =>
        before.has(r.key)
          ? r
          : {
              ...r,
              size: sharedSize,
              substrate: sharedSubstrate,
              notes: sharedNotes,
            },
      ),
    }))
  }

  const validations = new Map(
    pending.map((e) => [
      e.id,
      validatePotRows(drafts[e.id] ?? [], info.get(e.id)?.available ?? null),
    ]),
  )
  const anyOver = [...validations.values()].some((v) => v.overBy > 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setShowErrors(true)
    if (!user) {
      setSubmitError('You must be signed in to pot plants.')
      return
    }
    if (!pottedOn) {
      setSubmitError('Pick the potting date.')
      return
    }
    if (pottedOn > today()) {
      setSubmitError('The potting date cannot be in the future.')
      return
    }
    if (![...validations.values()].every((v) => v.ok)) {
      setSubmitError('Fix the experiments marked below before saving.')
      return
    }

    setBusy(true)
    const nextFailures: Record<string, string> = {}
    const succeeded: Done[] = []
    // One potting per experiment, one after the other: each is its own
    // transaction, so one failing never blocks or undoes the others.
    for (const exp of pending) {
      const rows = drafts[exp.id] ?? []
      try {
        await savePotting({
          experimentId: exp.id,
          userId: user.id,
          pottedOn,
          notes: '',
          rows,
        })
        succeeded.push({
          id: exp.id,
          title: exp.title,
          plants: validations.get(exp.id)?.total ?? 0,
          pots: rows.length,
        })
      } catch (err) {
        nextFailures[exp.id] =
          err instanceof Error ? err.message : 'Could not save the potting.'
      }
    }

    const allDone = [...done, ...succeeded]
    const failedCount = Object.keys(nextFailures).length
    if (failedCount === 0) {
      const plants = allDone.reduce((n, d) => n + d.plants, 0)
      const potCount = allDone.reduce((n, d) => n + d.pots, 0)
      navigate(backTo, {
        replace: true,
        state: {
          toast: `Potted ${plantsLabel(plants)} into ${potsLabel(potCount)} across ${allDone.length} ${allDone.length === 1 ? 'experiment' : 'experiments'}.`,
        },
      })
      return
    }
    setDone(allDone)
    setFailures(nextFailures)
    setPendingIds((prev) => prev.filter((id) => id in nextFailures))
    setSubmitError(
      `${succeeded.length} of ${pending.length} saved. Fix or retry the ${failedCount === 1 ? 'one' : failedCount} that failed.`,
    )
    setBusy(false)
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <BackLink to={backTo} />
        <h1 className="text-xl font-medium text-on-surface">
          Pot selected experiments
        </h1>
      </div>
      <p className="mb-4 text-sm text-on-surface-variant">{folder.title}</p>

      {done.length > 0 && (
        <div className="mb-4 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 shrink-0" />
            Already potted
          </p>
          <ul className="mt-1 list-disc pl-6">
            {done.map((d) => (
              <li key={d.id}>
                {d.title}: {plantsLabel(d.plants)} into {potsLabel(d.pots)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-3 rounded-lg bg-surface-container p-3">
          <h2 className="text-base font-medium text-on-surface">
            Shared by all experiments
          </h2>
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Date potted *
            <input
              type="date"
              value={pottedOn}
              max={today()}
              onChange={(e) => setPottedOn(e.target.value)}
              disabled={busy}
              className={inputClass}
            />
          </label>
          <p className="-mt-1 text-xs text-on-surface-variant">
            Pot size, substrate and notes below are copied into every pot of
            every experiment as you type. You can still change them per pot
            afterwards.
          </p>
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Pot size (optional)
            <input
              type="text"
              value={sharedSize}
              onChange={(e) => {
                setSharedSize(e.target.value)
                applyShared('size', e.target.value)
              }}
              disabled={busy}
              placeholder="e.g. 10 cm"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Substrate (optional)
            <input
              type="text"
              value={sharedSubstrate}
              onChange={(e) => {
                setSharedSubstrate(e.target.value)
                applyShared('substrate', e.target.value)
              }}
              disabled={busy}
              placeholder="e.g. peat + perlite"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Notes (optional)
            <textarea
              rows={2}
              value={sharedNotes}
              onChange={(e) => {
                setSharedNotes(e.target.value)
                applyShared('notes', e.target.value)
              }}
              disabled={busy}
              className={inputClass}
            />
          </label>
        </div>

        {pending.map((exp) => {
          const meta = info.get(exp.id)
          const v = validations.get(exp.id)
          const failure = failures[exp.id]
          const invalid = showErrors && v && !v.ok
          return (
            <div
              key={exp.id}
              className={`flex flex-col gap-3 rounded-lg p-3 ring-1 ${
                failure || invalid ? 'ring-error' : 'ring-outline-variant'
              }`}
            >
              <h2 className="text-base font-medium text-on-surface">
                {exp.title}
              </h2>
              <div className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
                <p>
                  Plants available to pot:{' '}
                  <span className="font-medium">
                    {meta?.available == null
                      ? 'no plant count set'
                      : meta.available}
                  </span>
                </p>
                {meta?.ready && (
                  <p className="mt-1 text-on-surface-variant">
                    Up to {meta.ready.count} may be ready (R2: {meta.ready.r2},
                    S3: {meta.ready.s3}). Only a hint — pot as many as you like.
                  </p>
                )}
              </div>
              {failure && (
                <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
                  Not saved: {failure}
                </p>
              )}
              <PotRowsEditor
                rows={drafts[exp.id] ?? []}
                onChange={(rows) => setRows(exp.id, rows)}
                available={meta?.available ?? null}
                showErrors={showErrors}
                disabled={busy}
                firstNumber={firstNumbers.get(exp.id) ?? 1}
              />
            </div>
          )
        })}

        {submitError && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            to={backTo}
            className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            {done.length > 0 ? 'Back to folder' : 'Cancel'}
          </Link>
          <button
            type="submit"
            disabled={busy || anyOver}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy
              ? 'Saving…'
              : Object.keys(failures).length > 0
                ? 'Retry failed pottings'
                : `Save ${pending.length === 1 ? 'potting' : `${pending.length} pottings`}`}
          </button>
        </div>
      </form>
    </section>
  )
}
