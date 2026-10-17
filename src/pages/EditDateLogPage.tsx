import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import DateLogForm from '../components/DateLogForm'
import { useExperimentPhases } from '../lib/hooks/useExperimentPhases'
import type { DateLog, Experiment, Folder } from '../types/database'

/** Edit a log entry; its own `phase` decides which form (Phase 1 or Phase 2) opens. */
export default function EditDateLogPage() {
  const { id, logId } = useParams<{ id: string; logId: string }>()
  const location = useLocation()
  const navState = location.state as {
    log?: DateLog
    experiment?: Experiment
    folder?: Folder
  } | null

  const { experiment, logs, pottings, pots, phaseInput, loading, error } =
    useExperimentPhases(id, navState?.experiment)
  const log = logs.find((l) => l.id === logId) ?? null

  const backTo = id ? `/experiments/${id}` : '/experiments'
  const potted = log?.phase === 'potted'

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
        <h1 className="text-xl font-medium text-on-surface">
          {potted ? 'Edit Pot Check-in' : 'Edit Log Entry'}
        </h1>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!id || !logId ? (
        <p className="text-sm text-error">Missing experiment or log id.</p>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : !log ? (
        <p className="text-sm text-error">Log entry not found.</p>
      ) : (
        <DateLogForm
          experimentId={id}
          mode="edit"
          phase={log.phase}
          initial={log}
          phaseInput={phaseInput}
          pottings={pottings}
          pots={pots}
          backTo={backTo}
          doneState={{ experiment, folder: navState?.folder }}
          successToast={potted ? 'Pot check-in updated.' : 'Log entry updated.'}
        />
      )}
    </section>
  )
}
