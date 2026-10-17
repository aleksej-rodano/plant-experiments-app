import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PotRowsEditor from '../components/PotRowsEditor'
import { useAuth } from '../lib/hooks/useAuth'
import { useExperimentPhases } from '../lib/hooks/useExperimentPhases'
import { today } from '../lib/utils/care'
import {
  phase1Cohort,
  phase1Spare,
  readyToPot,
} from '../lib/utils/phases'
import {
  newPotRow,
  plantsLabel,
  potsLabel,
  savePotting,
  validatePotRows,
  type PotRowDraft,
} from '../lib/utils/potting'
import { stageSnapshot } from '../lib/utils/stages'
import type { DateLog, Experiment, Pot } from '../types/database'
import type { PhaseInput } from '../lib/utils/phases'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function PotPlantsPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const seeded =
    (location.state as { experiment?: Experiment } | null)?.experiment ?? null

  const { experiment, logs, pots, phaseInput, loading, error } =
    useExperimentPhases(id, seeded)

  const backTo = id ? `/experiments/${id}` : '/experiments'

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !experiment) {
    return (
      <section className="mx-auto max-w-lg">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error ?? 'Experiment not found.'}
        </p>
      </section>
    )
  }

  return (
    <PotPlantsForm
      experiment={experiment}
      logs={logs}
      pots={pots}
      phaseInput={phaseInput}
      backTo={backTo}
    />
  )
}

function PotPlantsForm({
  experiment,
  logs,
  pots,
  phaseInput,
  backTo,
}: {
  experiment: Experiment
  logs: DateLog[]
  pots: Pot[]
  phaseInput: PhaseInput
  backTo: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const id = experiment.id

  const [pottedOn, setPottedOn] = useState(today())
  const [notes, setNotes] = useState('')
  // Labels carry on from the pots already in this experiment, so a second
  // potting starts at "Pot 3" instead of colliding with the first one's "Pot 1".
  const firstNumber = pots.length + 1
  const [rows, setRows] = useState<PotRowDraft[]>(() => [newPotRow(firstNumber)])
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Backdated pottings must leave room for later pottings and deaths, so the cap
  // is phase1Spare (the latest point in time), not the Phase 1 count on the date.
  const available = phase1Spare(phaseInput)
  const validation = validatePotRows(rows, available)

  const ready = useMemo(() => {
    const phase1Logs = logs.filter((l) => l.phase !== 'potted')
    const snap = stageSnapshot(phase1Logs, (asOf) =>
      phase1Cohort(phaseInput, asOf),
    )
    return readyToPot(snap)
  }, [logs, phaseInput])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setShowErrors(true)
    if (!user) {
      setSubmitError('You must be signed in to pot plants.')
      return
    }
    if (!pottedOn) {
      setSubmitError('Pick the potting date.')
      return
    }
    if (pottedOn > today()) {
      setSubmitError('The potting date cannot be in the future.')
      return
    }
    if (!validation.ok) return

    setBusy(true)
    try {
      await savePotting({
        experimentId: id,
        userId: user.id,
        pottedOn,
        notes,
        rows,
      })
      navigate(backTo, {
        replace: true,
        state: {
          toast: `Potted ${plantsLabel(validation.total)} into ${potsLabel(rows.length)}.`,
        },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the potting.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={backTo}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Pot plants</h1>
      </div>
      <p className="mb-4 text-sm text-on-surface-variant">{experiment.title}</p>

      <div className="mb-4 rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
        <p>
          Plants available to pot:{' '}
          <span className="font-medium">
            {available == null ? 'no plant count set' : available}
          </span>
        </p>
        {ready && (
          <p className="mt-1 text-on-surface-variant">
            Up to {ready.count} may be ready (R2: {ready.r2}, S3: {ready.s3}).
            This is only a hint — pot as many as you like.
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Date potted *
          <input
            type="date"
            value={pottedOn}
            max={today()}
            onChange={(e) => setPottedOn(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <h2 className="-mb-2 text-base font-medium text-on-surface">Pots</h2>
        <PotRowsEditor
          rows={rows}
          onChange={setRows}
          available={available}
          showErrors={showErrors}
          disabled={busy}
          firstNumber={firstNumber}
        />

        {submitError && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            to={backTo}
            className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy || validation.overBy > 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Saving…' : 'Save potting'}
          </button>
        </div>
      </form>
    </section>
  )
}
