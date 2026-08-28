import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Loader2,
  MapPin,
  Plus,
  Sprout,
  Tag,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import DateLogTimeline from '../components/DateLogTimeline'
import { supabase } from '../lib/supabase'
import type { DateLog, Experiment } from '../types/database'

function BackLink() {
  return (
    <Link
      to="/experiments"
      className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
    >
      <ArrowLeft className="size-4" />
      Experiments
    </Link>
  )
}

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Data handed over from the "Add Log Entry" flow, captured once on mount so it
  // survives the state-clearing navigation in the toast effect below.
  const handoff = useRef(
    (location.state as { experiment?: Experiment; newLog?: DateLog } | null) ?? {},
  )
  const seededExperiment = handoff.current.experiment
  const seedLogs = handoff.current.newLog ? [handoff.current.newLog] : undefined

  const [experiment, setExperiment] = useState<Experiment | null>(
    seededExperiment ?? null,
  )
  const [loading, setLoading] = useState(!seededExperiment)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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
    // When the row was handed over from the list (or the add-log flow) render it
    // immediately and only refresh in the background — no blocking spinner.
    void load({ background: Boolean(seededExperiment) })
  }, [load, seededExperiment])

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (!state?.toast) return
    setToast(state.toast)
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [location.state, navigate])

  async function handleExport() {
    if (!experiment) return
    setExporting(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('date_logs')
        .select()
        .eq('experiment_id', experiment.id)
        .order('log_date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      // Lazy-loaded: keeps jspdf + html2canvas (~1 MB) out of the initial bundle.
      const { exportExperimentToPDF } = await import('../lib/utils/pdfExport')
      await exportExperimentToPDF(experiment, data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const { error } = await supabase.from('experiments').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setDeleting(false)
      return
    }
    navigate('/experiments', {
      replace: true,
      state: { toast: 'Experiment deleted.' },
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

  if (!experiment) {
    return (
      <section className="mx-auto max-w-2xl">
        <BackLink />
        <p className="mt-4 rounded-lg bg-surface-container px-3 py-6 text-center text-sm text-on-surface-variant">
          Experiment not found.
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

      <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-variant">
        {experiment.cover_image_url ? (
          <img
            src={experiment.cover_image_url}
            alt={experiment.title}
            className="size-full object-cover"
          />
        ) : (
          <Sprout className="size-12 text-on-surface-variant/50" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-medium text-on-surface">{experiment.title}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            <span className="hidden sm:inline">
              {exporting ? 'Exporting…' : 'Export PDF'}
            </span>
          </button>
          <Link
            to={`/experiments/${experiment.id}/logs/new`}
            state={{ experiment }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Log Entry</span>
          </Link>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-surface-container px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
            <Sprout className="size-3.5" />
            Plants
          </dt>
          <dd className="mt-0.5 text-on-surface">{experiment.plant_count}</dd>
        </div>
        <div className="rounded-lg bg-surface-container px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
            <MapPin className="size-3.5" />
            Origin
          </dt>
          <dd className="mt-0.5 text-on-surface">{experiment.origin}</dd>
        </div>
        {experiment.initial_price != null && (
          <div className="rounded-lg bg-surface-container px-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Tag className="size-3.5" />
              Initial price
            </dt>
            <dd className="mt-0.5 text-on-surface">
              ${experiment.initial_price.toFixed(2)}
            </dd>
          </div>
        )}
      </dl>

      {experiment.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
          {experiment.notes}
        </p>
      )}

      <h2 className="mt-6 mb-3 text-lg font-medium text-on-surface">Timeline</h2>
      <DateLogTimeline experimentId={experiment.id} initialLogs={seedLogs} />

      <div className="mt-8 border-t border-outline-variant pt-4">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-on-surface-variant">
              Delete this experiment and its logs?
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
