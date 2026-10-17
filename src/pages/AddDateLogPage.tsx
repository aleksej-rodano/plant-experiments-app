import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import DateLogForm from '../components/DateLogForm'
import { usePottings } from '../lib/hooks/usePottings'
import { supabase } from '../lib/supabase'
import type { DateLog, Experiment, Folder } from '../types/database'

type PhaseLog = Pick<
  DateLog,
  'id' | 'log_date' | 'deaths_count' | 'phase' | 'pot_id' | 'deleted_at'
>

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
  const [phaseLogs, setPhaseLogs] = useState<PhaseLog[] | null>(null)
  const { pottings, pots, loading: pottingsLoading } = usePottings(id ? [id] : [])
  const [error, setError] = useState<string | null>(null)

  const backTo = id ? `/experiments/${id}` : '/experiments'

  useEffect(() => {
    if (!id) return
    let cancelled = false
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
          .select('id, log_date, deaths_count, phase, pot_id, deleted_at')
          .eq('experiment_id', id)
          .is('deleted_at', null),
      ])
      if (cancelled) return
      if (expRes.error) setError(expRes.error.message)
      else if (expRes.data) setExperiment(expRes.data)
      if (logRes.error) setError(logRes.error.message)
      setPhaseLogs(logRes.data ?? [])
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
      ) : phaseLogs == null || pottingsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <DateLogForm
          experimentId={id}
          mode="add"
          phaseInput={{
            experiment: { plant_count: experiment?.plant_count ?? null },
            pottings,
            pots,
            logs: phaseLogs,
          }}
          backTo={backTo}
          doneState={{ experiment, folder: navState?.folder }}
          successToast="Log entry added."
        />
      )}
    </section>
  )
}
