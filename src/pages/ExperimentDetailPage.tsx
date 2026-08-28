import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import DateLogTimeline from '../components/DateLogTimeline'
import { supabase } from '../lib/supabase'
import type { DateLog, Experiment, Folder } from '../types/database'

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
      newLog?: DateLog
    } | null) ?? {},
  )
  const seededExperiment = handoff.current.experiment
  const seedLogs = handoff.current.newLog ? [handoff.current.newLog] : undefined

  const [experiment, setExperiment] = useState<Experiment | null>(
    seededExperiment ?? null,
  )
  const [folder, setFolder] = useState<Folder | null>(
    handoff.current.folder ?? null,
  )
  const [loading, setLoading] = useState(!seededExperiment)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const folderId = experiment?.folder_id ?? folder?.id ?? null
  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

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

  function BackLink() {
    return (
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="size-4" />
        {folder?.title ?? (folderId ? 'Folder' : 'Folders')}
      </Link>
    )
  }

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
      await exportExperimentToPDF(experiment, data ?? [], folder)
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
    navigate(backTo, {
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

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {folder && (
            <p className="text-sm text-on-surface-variant">{folder.title}</p>
          )}
          <h1 className="text-2xl font-medium text-on-surface">
            {experiment.title}
          </h1>
        </div>
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
            state={{ experiment, folder }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Log Entry</span>
          </Link>
        </div>
      </div>

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
