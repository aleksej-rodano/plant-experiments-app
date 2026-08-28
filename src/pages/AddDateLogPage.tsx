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

  const backTo = id ? `/experiments/${id}` : '/experiments'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      const [expRes, logRes] = await Promise.all([
        experiment
          ? Promise.resolve({ data: experiment, error: null })
          : supabase.from('experiments').select().eq('id', id).maybeSingle(),
        supabase.from('date_logs').select('deaths_count').eq('experiment_id', id),
      ])
      if (cancelled) return
      if (expRes.error) setError(expRes.error.message)
      else if (expRes.data) setExperiment(expRes.data)
      if (logRes.error) setError(logRes.error.message)
      setPriorDeaths(totalDeaths(logRes.data ?? []))
    })()
    return () => {
      cancelled = true
    }
    // `experiment` intentionally excluded — we only fetch what's missing once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!id ? (
        <p className="text-sm text-error">Missing experiment id.</p>
      ) : priorDeaths == null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
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
