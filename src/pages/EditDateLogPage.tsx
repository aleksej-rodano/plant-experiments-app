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

export default function EditDateLogPage() {
  const { id, logId } = useParams<{ id: string; logId: string }>()
  const location = useLocation()
  const navState = location.state as {
    log?: DateLog
    experiment?: Experiment
    folder?: Folder
  } | null

  const [log, setLog] = useState<DateLog | null>(navState?.log ?? null)
  const [plantCount, setPlantCount] = useState<number | null>(
    navState?.experiment?.plant_count ?? null,
  )
  const [phaseLogs, setPhaseLogs] = useState<PhaseLog[] | null>(null)
  const { pottings, pots, loading: pottingsLoading } = usePottings(id ? [id] : [])
  const [error, setError] = useState<string | null>(null)

  const backTo = id ? `/experiments/${id}` : '/experiments'

  useEffect(() => {
    if (!id || !logId) return
    let cancelled = false
    void (async () => {
      const [logRow, expRow, allLogs] = await Promise.all([
        navState?.log
          ? Promise.resolve({ data: navState.log, error: null })
          : supabase
              .from('date_logs')
              .select()
              .eq('id', logId)
              .is('deleted_at', null)
              .maybeSingle(),
        navState?.experiment?.plant_count != null
          ? Promise.resolve({
              data: { plant_count: navState.experiment.plant_count },
              error: null,
            })
          : supabase
              .from('experiments')
              .select('plant_count')
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
      if (logRow.error) setError(logRow.error.message)
      else if (logRow.data) setLog(logRow.data)
      if (expRow.error) setError(expRow.error.message)
      else if (expRow.data) setPlantCount(expRow.data.plant_count ?? null)
      if (allLogs.error) {
        setError(allLogs.error.message)
        setPhaseLogs([])
      } else {
        // Includes the entry being edited; the form leaves it out where needed.
        setPhaseLogs(allLogs.data ?? [])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, logId])

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
        <h1 className="text-xl font-medium text-on-surface">Edit Log Entry</h1>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!id || !logId ? (
        <p className="text-sm text-error">Missing experiment or log id.</p>
      ) : !log || phaseLogs == null || pottingsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <DateLogForm
          experimentId={id}
          mode="edit"
          initial={log}
          phaseInput={{
            experiment: { plant_count: plantCount },
            pottings,
            pots,
            logs: phaseLogs,
          }}
          backTo={backTo}
          doneState={{
            experiment: navState?.experiment,
            folder: navState?.folder,
          }}
          successToast="Log entry updated."
        />
      )}
    </section>
  )
}
