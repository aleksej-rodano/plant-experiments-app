import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import DateLogForm from '../components/DateLogForm'
import { useExperimentPhases } from '../lib/hooks/useExperimentPhases'
import { phaseFromParams } from '../lib/utils/potLogs'
import type { Experiment, Folder } from '../types/database'

/**
 * Add a log entry. The phase comes from where the user came from:
 * `?phase=potted&pot=<potId>` opens the Phase 2 (pot check-in) form, anything
 * else is the Phase 1 propagation form.
 */
export default function AddDateLogPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const [params] = useSearchParams()
  const navState = location.state as {
    experiment?: Experiment
    folder?: Folder
  } | null

  const phase = phaseFromParams(params)
  const { experiment, pottings, pots, phaseInput, loading, error } =
    useExperimentPhases(id, navState?.experiment)

  const backTo = id ? `/experiments/${id}` : '/experiments'

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
          {phase === 'potted' ? 'Add Pot Check-in' : 'Add Log Entry'}
        </h1>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!id ? (
        <p className="text-sm text-error">Missing experiment id.</p>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : phase === 'potted' && pots.length === 0 ? (
        <p className="rounded-lg bg-surface-container px-3 py-4 text-sm text-on-surface-variant">
          This experiment has no pots yet. Use “Pot plants” on the experiment
          first — every Phase 2 check-in belongs to a pot.
        </p>
      ) : (
        <DateLogForm
          experimentId={id}
          mode="add"
          phase={phase}
          initialPotId={params.get('pot')}
          phaseInput={phaseInput}
          pottings={pottings}
          pots={pots}
          backTo={backTo}
          doneState={{ experiment, folder: navState?.folder }}
          successToast={
            phase === 'potted' ? 'Pot check-in added.' : 'Log entry added.'
          }
        />
      )}
    </section>
  )
}
