import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sheet,
  Sprout,
  Tag,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CareBanner from '../components/CareBanner'
import ComparisonChart from '../components/ComparisonChart'
import WinnerCallout from '../components/WinnerCallout'
import { isNativeApp } from '../lib/native'
import { supabase } from '../lib/supabase'
import { binFolder } from '../lib/utils/bin'
import { today } from '../lib/utils/care'
import { exportFolderToCSV } from '../lib/utils/csvExport'
import { summariseAll } from '../lib/utils/insights'
import {
  SURVIVAL_TEXT_CLASS,
  SURVIVAL_TILE_CLASS,
  formatRate,
  survivalLevel,
} from '../lib/utils/survival'
import type { DateLog, Experiment, Folder } from '../types/database'

function BackLink() {
  return (
    <Link
      to="/experiments"
      className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
    >
      <ArrowLeft className="size-4" />
      Folders
    </Link>
  )
}

export default function FolderDetailPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const seeded = useRef(
    (location.state as { folder?: Folder } | null)?.folder ?? null,
  )

  const [folder, setFolder] = useState<Folder | null>(seeded.current)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [logs, setLogs] = useState<DateLog[]>([])
  const [loading, setLoading] = useState(!seeded.current)
  const [expLoading, setExpLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const summaries = useMemo(
    () => summariseAll(experiments, logs),
    [experiments, logs],
  )
  const summaryFor = (id: string) => summaries.find((s) => s.experiment.id === id)

  const totalPlants = experiments.reduce(
    (sum, e) => sum + (e.plant_count ?? 0),
    0,
  )
  const totalAlive = summaries.reduce((sum, s) => sum + s.alive, 0)
  const folderRateValue = totalPlants > 0 ? totalAlive / totalPlants : null
  const folderRate = folderRateValue == null ? '—' : formatRate(folderRateValue)

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!folderId) return
      if (!opts?.background) setLoading(true)
      setExpLoading(true)
      setError(null)

      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 15000)
      try {
        const [folderRes, expRes] = await Promise.all([
          supabase
            .from('folders')
            .select()
            .eq('id', folderId)
            .is('deleted_at', null)
            .abortSignal(controller.signal)
            .maybeSingle(),
          supabase
            .from('experiments')
            .select()
            .eq('folder_id', folderId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .abortSignal(controller.signal),
        ])
        if (folderRes.error) throw folderRes.error
        if (expRes.error) throw expRes.error
        setFolder(folderRes.data)
        const exps = expRes.data ?? []
        setExperiments(exps)

        if (exps.length > 0) {
          // Full rows (not just deaths): the comparison charts, the verdict, and
          // the CSV export all read from this one fetch.
          const { data: logRows } = await supabase
            .from('date_logs')
            .select()
            .in(
              'experiment_id',
              exps.map((e) => e.id),
            )
            .is('deleted_at', null)
            .order('log_date', { ascending: true })
            .abortSignal(controller.signal)
          setLogs(logRows ?? [])
        } else {
          setLogs([])
        }
      } catch (e) {
        if (!opts?.background) {
          setError(
            controller.signal.aborted
              ? 'The server took too long to respond. Check your connection and retry.'
              : e instanceof Error
                ? e.message
                : 'Failed to load folder.',
          )
        }
      } finally {
        clearTimeout(abortTimer)
        setLoading(false)
        setExpLoading(false)
      }
    },
    [folderId],
  )

  useEffect(() => {
    void load({ background: Boolean(seeded.current) })
  }, [load])

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (!state?.toast) return
    setToast(state.toast)
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [location.state, navigate])

  async function handleMarkCareDone() {
    if (!folderId) return
    const { data, error } = await supabase
      .from('folders')
      .update({ care_last_done_on: today() })
      .eq('id', folderId)
      .select()
      .maybeSingle()
    if (error) {
      setError(error.message)
      return
    }
    if (data) setFolder(data)
    setToast('Marked done.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDelete() {
    if (!folderId) return
    setDeleting(true)
    try {
      await binFolder(folderId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the folder.')
      setDeleting(false)
      return
    }
    navigate('/experiments', {
      replace: true,
      state: { toast: 'Folder moved to the bin.' },
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !folder) {
    return (
      <section className="mx-auto max-w-2xl">
        <BackLink />
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
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

  if (!folder) {
    return (
      <section className="mx-auto max-w-2xl">
        <BackLink />
        <p className="mt-4 rounded-lg bg-surface-container px-3 py-6 text-center text-sm text-on-surface-variant">
          Folder not found.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl">
      <BackLink />

      {toast && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <CareBanner folder={folder} onMarkDone={handleMarkCareDone} />

      <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-variant">
        {folder.cover_image_url ? (
          <img
            src={folder.cover_image_url}
            alt={folder.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <Sprout className="size-12 text-on-surface-variant/50" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-medium text-on-surface">{folder.title}</h1>
        <div className="flex gap-2">
          <Link
            to={`/folders/${folder.id}/edit`}
            state={{ folder }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
          {experiments.length > 0 && !isNativeApp() && (
            <button
              type="button"
              onClick={() => exportFolderToCSV(folder, experiments, logs)}
              title="Export every experiment in this folder as a spreadsheet"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
            >
              <Sheet className="size-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}
          {experiments.length > 0 && (
            <Link
              to={`/folders/${folder.id}/logs/new`}
              state={{ folder, experiments }}
              title="Add one log entry to every experiment in this folder"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
            >
              <CalendarPlus className="size-4" />
              <span className="hidden sm:inline">Log all</span>
            </Link>
          )}
          <Link
            to={`/folders/${folder.id}/experiments/new`}
            state={{ folder }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Experiment</span>
          </Link>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div
          className={`rounded-lg px-3 py-2 ${
            SURVIVAL_TILE_CLASS[survivalLevel(folderRateValue)]
          }`}
        >
          <dt className="flex items-center gap-1 text-xs">
            <Sprout className="size-3.5" />
            Surviving plants
          </dt>
          <dd className="mt-0.5 text-lg font-medium">
            {totalAlive}
            <span className="text-sm font-normal">
              {' / '}
              {totalPlants} ({folderRate})
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-surface-container px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
            <FlaskConical className="size-3.5" />
            Experiments
          </dt>
          <dd className="mt-0.5 text-on-surface">
            {experiments.length}
            <span className="text-xs text-on-surface-variant">
              {' '}
              · {totalPlants} plant{totalPlants === 1 ? '' : 's'} started
            </span>
          </dd>
        </div>
        {folder.origin && (
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
              <MapPin className="size-3.5" />
              Origin
            </dt>
            <dd className="mt-0.5 text-on-surface">{folder.origin}</dd>
          </div>
        )}
        {folder.initial_price != null && (
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Tag className="size-3.5" />
              Initial price
            </dt>
            <dd className="mt-0.5 text-on-surface">
              ${folder.initial_price.toFixed(2)}
            </dd>
          </div>
        )}
      </dl>

      {folder.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
          {folder.notes}
        </p>
      )}

      <WinnerCallout summaries={summaries} />

      {experiments.length >= 2 && logs.length > 0 && (
        <>
          <h2 className="mt-6 mb-3 text-lg font-medium text-on-surface">
            Comparison
          </h2>
          <ComparisonChart experiments={experiments} logs={logs} />
        </>
      )}

      <h2 className="mt-6 mb-3 text-lg font-medium text-on-surface">
        Experiments
      </h2>

      {expLoading && experiments.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : experiments.length === 0 ? (
        <div className="rounded-lg bg-surface-container px-4 py-12 text-center">
          <FlaskConical className="mx-auto mb-3 size-8 text-on-surface-variant/50" />
          <p className="text-on-surface">No experiments in this folder yet.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            e.g. "rooting powder", "smaller cuttings", "control".
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {experiments.map((exp) => (
            <li key={exp.id}>
              <Link
                to={`/experiments/${exp.id}`}
                state={{ experiment: exp, folder }}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-container px-4 py-3 hover:opacity-90"
              >
                {exp.cover_image_url && (
                  <img
                    src={exp.cover_image_url}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-on-surface">
                    {exp.title}
                  </span>
                  <span className="block truncate text-sm text-on-surface-variant">
                    <span
                      className={
                        SURVIVAL_TEXT_CLASS[
                          survivalLevel(summaryFor(exp.id)?.rate ?? null)
                        ]
                      }
                    >
                      {summaryFor(exp.id)?.alive ?? 0}/{exp.plant_count ?? 0}
                    </span>{' '}
                    alive
                    {summaryFor(exp.id)?.daysToRoot != null &&
                      ` · rooted in ${summaryFor(exp.id)?.daysToRoot}d`}
                    {exp.status !== 'ongoing' ? ` · ${exp.status}` : ''}
                    {exp.notes ? ` · ${exp.notes}` : ''}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-on-surface-variant" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 border-t border-outline-variant pt-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-on-surface-variant">
              Move this folder, its experiments and all their logs to the bin?
            </span>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-variant"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-on-error disabled:opacity-60"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-error hover:underline"
          >
            <Trash2 className="size-4" />
            Delete folder
          </button>
        )}
      </div>
    </section>
  )
}
