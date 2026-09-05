import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Sheet,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CareBanner from '../components/CareBanner'
import DateLogTimeline from '../components/DateLogTimeline'
import MeasurementsChart from '../components/MeasurementsChart'
import { isNativeApp, syncCareNotifications } from '../lib/native'
import { supabase } from '../lib/supabase'
import { binExperiment } from '../lib/utils/bin'
import { today } from '../lib/utils/care'
import { exportExperimentToCSV } from '../lib/utils/csvExport'
import {
  SURVIVAL_TEXT_CLASS,
  formatRate,
  successRate,
  survivalLevel,
  survivorCount,
  totalDeaths,
} from '../lib/utils/survival'
import type { DateLog, Experiment, ExperimentStatus, Folder } from '../types/database'

const STATUS_STYLE: Record<ExperimentStatus, string> = {
  ongoing: 'bg-surface-variant text-on-surface-variant',
  succeeded: 'bg-secondary-container text-on-secondary-container',
  failed: 'bg-error-container text-on-error-container',
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  )
}

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Data handed over from the folder view or the "Add Log Entry" flow, captured
  // once on mount so it survives the state-clearing navigation in the toast effect.
  const handoff = useRef(
    (location.state as {
      experiment?: Experiment
      folder?: Folder
    } | null) ?? {},
  )
  const seededExperiment = handoff.current.experiment

  const [experiment, setExperiment] = useState<Experiment | null>(
    seededExperiment ?? null,
  )
  const [timelineLogs, setTimelineLogs] = useState<DateLog[]>([])
  const [folder, setFolder] = useState<Folder | null>(
    handoff.current.folder ?? null,
  )
  const [loading, setLoading] = useState(!seededExperiment)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)

  const folderId = experiment?.folder_id ?? folder?.id ?? null
  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

  const handleLogsChange = useCallback((next: DateLog[]) => {
    setTimelineLogs(next)
  }, [])

  const stats = useMemo(() => {
    const initial = experiment?.plant_count ?? null
    const deaths = totalDeaths(timelineLogs)
    return {
      deaths,
      alive: survivorCount(initial, deaths),
      rate: successRate(initial, deaths),
      initial,
    }
  }, [experiment?.plant_count, timelineLogs])

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!id) return
      if (!opts?.background) setLoading(true)
      setError(null)

      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 12000)
      try {
        const { data, error } = await supabase
          .from('experiments')
          .select()
          .eq('id', id)
          .is('deleted_at', null)
          .abortSignal(controller.signal)
          .maybeSingle()
        if (error) throw error
        setExperiment(data)
      } catch (e) {
        // A background refresh that fails just leaves the seeded row on screen.
        if (!opts?.background) {
          setError(
            controller.signal.aborted
              ? 'The server took too long to respond. Check your connection and retry.'
              : e instanceof Error
                ? e.message
                : 'Failed to load experiment.',
          )
        }
      } finally {
        clearTimeout(abortTimer)
        setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    void load({ background: Boolean(seededExperiment) })
  }, [load, seededExperiment])

  // Pull the parent folder in if we weren't handed it (needed for the PDF facts
  // and the back link label).
  useEffect(() => {
    const fid = experiment?.folder_id
    if (!fid || folder?.id === fid) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('folders')
        .select()
        .eq('id', fid)
        .is('deleted_at', null)
        .maybeSingle()
      if (!cancelled && data) setFolder(data)
    })()
    return () => {
      cancelled = true
    }
  }, [experiment?.folder_id, folder?.id])

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (!state?.toast) return
    setToast(state.toast)
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [location.state, navigate])

  const backLabel = folder?.title ?? (folderId ? 'Folder' : 'Folders')

  async function handleExport(format: 'pdf' | 'csv') {
    if (!experiment) return
    setExporting(format)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('date_logs')
        .select()
        .eq('experiment_id', experiment.id)
        .is('deleted_at', null)
        .order('log_date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)

      if (format === 'csv') {
        exportExperimentToCSV(experiment, data ?? [], folder)
      } else {
        // Lazy-loaded: keeps jspdf + html2canvas (~1 MB) out of the initial bundle.
        const { exportExperimentToPDF } = await import('../lib/utils/pdfExport')
        await exportExperimentToPDF(experiment, data ?? [], folder)
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `${format.toUpperCase()} export failed.`,
      )
    } finally {
      setExporting(null)
    }
  }

  async function handleMarkCareDone() {
    if (!experiment) return
    const { data, error } = await supabase
      .from('experiments')
      .update({ care_last_done_on: today() })
      .eq('id', experiment.id)
      .select()
      .maybeSingle()
    if (error) {
      setError(error.message)
      return
    }
    if (data) setExperiment(data)
    void syncCareNotifications()
    setToast('Marked done.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      await binExperiment(id)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to delete the experiment.',
      )
      setDeleting(false)
      return
    }
    navigate(backTo, {
      replace: true,
      state: { toast: 'Experiment moved to the bin.' },
    })
  }

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
        <BackLink to={backTo} label={backLabel} />
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

  if (!experiment) {
    return (
      <section className="mx-auto max-w-2xl">
        <BackLink to={backTo} label={backLabel} />
        <p className="mt-4 rounded-lg bg-surface-container px-3 py-6 text-center text-sm text-on-surface-variant">
          Experiment not found.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl">
      <BackLink to={backTo} label={backLabel} />

      {toast && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <CareBanner
        schedule={experiment}
        editHref={`/experiments/${experiment.id}/edit`}
        editState={{ experiment }}
        onMarkDone={handleMarkCareDone}
      />

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {folder && (
            <p className="text-sm text-on-surface-variant">{folder.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium text-on-surface">
              {experiment.title}
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                STATUS_STYLE[experiment.status] ?? STATUS_STYLE.ongoing
              }`}
            >
              {experiment.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            {experiment.started_on && `Started ${formatDate(experiment.started_on)}`}
            {experiment.started_on && stats.initial != null && ' · '}
            {stats.initial != null && (
              <>
                <span
                  className={`font-medium ${
                    SURVIVAL_TEXT_CLASS[survivalLevel(stats.rate)]
                  }`}
                >
                  {stats.alive}/{stats.initial}
                </span>{' '}
                alive ({formatRate(stats.rate)})
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/experiments/${experiment.id}/edit`}
            state={{ experiment }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
          {/* Export and the quick-photo shortcut are web-only — the phone app
              drops them (no file downloads on device; photos go through the
              log form's camera/gallery choice instead). */}
          {!isNativeApp() && (
            <>
              <button
                type="button"
                onClick={() => void handleExport('pdf')}
                disabled={exporting != null}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant disabled:opacity-50"
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleExport('csv')}
                disabled={exporting != null}
                title="Export log entries as a spreadsheet"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant disabled:opacity-50"
              >
                {exporting === 'csv' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sheet className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {exporting === 'csv' ? 'Exporting…' : 'CSV'}
                </span>
              </button>
              <Link
                to={`/experiments/${experiment.id}/logs/photo`}
                state={{ experiment, folder }}
                title="Log a photo — note optional"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
              >
                <Camera className="size-4" />
                <span className="hidden sm:inline">Photo</span>
              </Link>
            </>
          )}
          <Link
            to={`/experiments/${experiment.id}/logs/new`}
            state={{ experiment, folder }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Log Entry</span>
          </Link>
        </div>
      </div>

      {experiment.cover_image_url && (
        <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-surface-variant">
          <img
            src={experiment.cover_image_url}
            alt={experiment.title}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {experiment.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
          {experiment.notes}
        </p>
      )}

      {timelineLogs.some(
        (l) =>
          l.root_length_mm != null ||
          l.new_leaves != null ||
          (l.deaths_count ?? 0) > 0,
      ) && (
        <div className="mt-4">
          <MeasurementsChart logs={timelineLogs} />
        </div>
      )}

      <h2 className="mt-6 mb-3 text-lg font-medium text-on-surface">Timeline</h2>
      <DateLogTimeline
        experimentId={experiment.id}
        experiment={experiment}
        folder={folder}
        onLogsChange={handleLogsChange}
      />

      <div className="mt-8 border-t border-outline-variant pt-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-on-surface-variant">
              Move this experiment and its logs to the bin?
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
            Delete experiment
          </button>
        )}
      </div>
    </section>
  )
}
