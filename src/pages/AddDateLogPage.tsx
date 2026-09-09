import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import DateLogForm from '../components/DateLogForm'
import { supabase } from '../lib/supabase'
import { totalDeaths } from '../lib/utils/survival'
import type { Experiment, Folder } from '../types/database'

export default function AddDateLogPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navState = location.state as {
    experiment?: Experiment
    folder?: Folder
  } | null

  const [experiment, setExperiment] = useState<Experiment | null>(
    navState?.experiment ?? null,
  )
  const [priorDeaths, setPriorDeaths] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const backTo = id ? `/experiments/${id}` : '/experiments'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setError(null)
    void (async () => {
      const [expRes, logRes] = await Promise.all([
        experiment
          ? Promise.resolve({ data: experiment, error: null })
          : supabase
              .from('experiments')
              .select()
              .eq('id', id)
              .is('deleted_at', null)
              .maybeSingle(),
        supabase
          .from('date_logs')
          .select('deaths_count')
          .eq('experiment_id', id)
          .is('deleted_at', null),
      ])
      if (cancelled) return
      if (expRes.error) setError(expRes.error.message)
      else if (expRes.data) setExperiment(expRes.data)
      if (logRes.error) {
        // Leave priorDeaths null so the form stays behind its spinner. Falling
        // through to 0 would raise the death cap to the full plant count and
        // let the user record losses that have already been recorded.
        setError(logRes.error.message)
        return
      }
      setPriorDeaths(totalDeaths(logRes.data ?? []))
    })()
    return () => {
      cancelled = true
    }
    // `experiment` intentionally excluded — we only fetch what's missing once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadKey])

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={backTo}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
          aria-label="Back to experiment"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Add Log Entry</h1>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((n) => n + 1)}
            className="shrink-0 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {!id ? (
        <p className="text-sm text-error">Missing experiment id.</p>
      ) : priorDeaths == null ? (
        error ? null : (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )
      ) : (
        <DateLogForm
          experimentId={id}
          mode="add"
          plantCount={experiment?.plant_count ?? null}
          priorDeaths={priorDeaths}
          backTo={backTo}
          doneState={{ experiment, folder: navState?.folder }}
          successToast="Log entry added."
        />
      )}
    </section>
  )
}
