import { Camera, Circle, ImagePlus, Loader2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhotoAnnotator from './PhotoAnnotator'
import QuickCareButtons from './QuickCareButtons'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { today } from '../lib/utils/care'
import { uploadImage, validateImage } from '../lib/utils/image'
import {
  phase1Cohort,
  phase1Deaths,
  phase1Spare,
  potAlive,
  pottedShare,
  type PhaseInput,
} from '../lib/utils/phases'
import { pottedOnOf } from '../lib/utils/potLogs'
import {
  ROOT_STAGES,
  SHOOT_STAGES,
  stageEntry,
  stageWarnings,
} from '../lib/utils/stages'
import { DEATH_CAUSE_SUGGESTIONS } from '../lib/utils/survival'
import type { DateLog, LogPhase, Pot, Potting } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

interface Props {
  experimentId: string
  mode: 'add' | 'edit'
  /**
   * Which phase this entry belongs to. 'potted' is the Phase 2 pot check-in form
   * (pot selector, health counts, no root/leaf tracks); the default
   * 'propagation' is the original form, unchanged.
   */
  phase?: LogPhase
  /** Pot to preselect (add mode, Phase 2). */
  initialPotId?: string | null
  /** Live pottings / pots of this experiment — the Phase 2 pot selector. */
  pottings?: Potting[]
  pots?: Pot[]
  /** The row being edited (edit mode only). */
  initial?: DateLog
  /**
   * Plant accounting for this experiment: its plant count, pottings, pots and
   * every live log (including the one being edited). Drives the death cap
   * (`phase1Spare`) and the stage reconciliation warnings (`phase1Cohort`).
   */
  phaseInput: PhaseInput
  /** Where to go after a successful save / cancel. */
  backTo: string
  /** Extra router state to carry back (e.g. the experiment + folder). */
  doneState?: Record<string, unknown>
  /** Toast message on success. */
  successToast: string
}

function numOrEmpty(v: number | null | undefined) {
  return v == null ? '' : String(v)
}

const STAGE_KEYS = [
  ...ROOT_STAGES.map((s) => s.key),
  ...SHOOT_STAGES.map((s) => s.key),
] as const

export default function DateLogForm({
  experimentId,
  mode,
  phase = 'propagation',
  initialPotId,
  pottings = [],
  pots = [],
  initial,
  phaseInput,
  backTo,
  doneState,
  successToast,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const potted = phase === 'potted'

  // Phase 2: which pot the entry belongs to, and the health tally of that pot.
  const sortedPots = useMemo(
    () =>
      [...pots].sort((a, b) => {
        const da = pottedOnOf(a, pottings) ?? ''
        const db = pottedOnOf(b, pottings) ?? ''
        return da === db
          ? a.created_at.localeCompare(b.created_at)
          : da.localeCompare(db)
      }),
    [pots, pottings],
  )
  const [potId, setPotId] = useState(() => {
    const wanted = initial?.pot_id ?? initialPotId ?? ''
    if (wanted && pots.some((p) => p.id === wanted)) return wanted
    return pots.length === 1 ? pots[0].id : ''
  })
  const [health, setHealth] = useState({
    good: numOrEmpty(initial?.health_good),
    ok: numOrEmpty(initial?.health_ok),
    poor: numOrEmpty(initial?.health_poor),
  })
  const selectedPot = pots.find((p) => p.id === potId)

  const [logDate, setLogDate] = useState(initial?.log_date ?? today())
  const [statusDetails, setStatusDetails] = useState(
    initial?.status_details ?? '',
  )

  // One text-state entry per stage bucket, keyed by column name.
  const [stages, setStages] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      STAGE_KEYS.map((k) => [k, numOrEmpty(initial?.[k])]),
    ),
  )
  const [leafingNoRoot, setLeafingNoRoot] = useState(
    numOrEmpty(initial?.leafing_without_rooting),
  )
  const [deaths, setDeaths] = useState(
    initial?.deaths_count ? String(initial.deaths_count) : '',
  )
  const [deathCause, setDeathCause] = useState(initial?.death_cause ?? '')

  const [image, setImage] = useState<File | null>(null)
  const [marking, setMarking] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(initial?.image_url ?? '')
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)
  // Two separate inputs: one forces the camera, one opens the file/gallery picker.
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quickPending, setQuickPending] = useState<
    'watered' | 'fertilized' | null
  >(null)

  // How many plants may still be marked dead in this entry: those that have not
  // been potted or died in any other Phase 1 entry, whatever this entry's date
  // (Phase 1 only shrinks, so a backdated death must leave room for later ones).
  // Editing: this entry's own deaths are added back.
  // Phase 2: the cap is the chosen pot's alive count (all-time, since a pot only
  // loses plants), again with this entry's own deaths added back when editing.
  const aliveBefore = potted
    ? potId
      ? potAlive(phaseInput, potId, undefined, { excludeLogId: initial?.id })
      : null
    : phase1Spare(phaseInput, { excludeLogId: initial?.id })
  const hasPots = (pottedShare(phaseInput) ?? 0) > 0

  const stagesTouched =
    !potted &&
    (STAGE_KEYS.some((k) => stages[k].trim() !== '') ||
      leafingNoRoot.trim() !== '')

  // Soft warning: the health tally describes the plants alive after this entry.
  const healthSum =
    (Number(health.good) || 0) + (Number(health.ok) || 0) + (Number(health.poor) || 0)
  const aliveAfter =
    aliveBefore == null ? null : aliveBefore - (Number(deaths) || 0)
  const healthWarning =
    potted && aliveAfter != null && healthSum > Math.max(0, aliveAfter)
      ? `Health counts add up to ${healthSum}, but only ${Math.max(0, aliveAfter)} plant${
          Math.max(0, aliveAfter) === 1 ? ' is' : 's are'
        } alive in this pot.`
      : null

  // Live soft warnings — a synthetic DateLog carrying just what's typed so far.
  const warnings = useMemo(() => {
    if (!stagesTouched) return []
    const draft = {
      ...Object.fromEntries(
        STAGE_KEYS.map((k) => [k, stages[k].trim() ? Number(stages[k]) : 0]),
      ),
      deaths_count: deaths.trim() ? Number(deaths) : 0,
      leafing_without_rooting: leafingNoRoot.trim() ? Number(leafingNoRoot) : 0,
    } as unknown as DateLog
    const entry = stageEntry(draft)
    // Buckets count the plants alive at this check-in, so reconcile them against
    // every Phase 1 death up to this date (not just this entry's), out of the
    // plants still in Phase 1 on that date.
    return entry
      ? stageWarnings(
          {
            ...entry,
            dead:
              entry.dead +
              phase1Deaths(phaseInput, logDate, { excludeLogId: initial?.id }),
          },
          phase1Cohort(phaseInput, logDate),
        )
      : []
  }, [stagesTouched, stages, deaths, leafingNoRoot, phaseInput, logDate, initial?.id])

  useEffect(() => {
    if (!image) {
      setNewPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(image)
    setNewPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  function setStage(key: string, value: string) {
    setStages((s) => ({ ...s, [key]: value }))
  }

  function pickImage(file: File | undefined) {
    if (!file) return
    const problem = validateImage(file)
    if (problem) {
      setErrors((e) => ({ ...e, image: problem }))
      return
    }
    setErrors((e) => ({ ...e, image: '' }))
    setImage(file)
  }

  function clearImage() {
    setImage(null)
    setCurrentUrl('')
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function wholeNonNeg(v: string) {
    const n = Number(v)
    return Number.isInteger(n) && n >= 0
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!logDate) next.logDate = 'Pick a date.'
    else if (logDate > today()) next.logDate = 'Date cannot be in the future.'

    if (potted) {
      if (!selectedPot) next.pot = 'Choose the pot this check-in is for.'
      else {
        const pottedOn = pottedOnOf(selectedPot, pottings)
        if (logDate && pottedOn && logDate < pottedOn)
          next.logDate = `This pot was potted on ${pottedOn}; pick that date or later.`
      }
      for (const k of ['good', 'ok', 'poor'] as const) {
        if (health[k].trim() && !wholeNonNeg(health[k]))
          next[`health_${k}`] = 'Whole number ≥ 0.'
      }
    }

    for (const k of STAGE_KEYS) {
      if (stages[k].trim() && !wholeNonNeg(stages[k])) {
        next[k] = 'Whole number ≥ 0.'
      }
    }
    if (leafingNoRoot.trim() && !wholeNonNeg(leafingNoRoot)) {
      next.leafingNoRoot = 'Whole number ≥ 0.'
    }

    if (deaths.trim()) {
      if (!wholeNonNeg(deaths)) {
        next.deaths = 'Enter a whole number ≥ 0.'
      } else if (aliveBefore != null && Number(deaths) > aliveBefore) {
        next.deaths = `Only ${aliveBefore} plant${
          aliveBefore === 1 ? '' : 's'
        } still ${potted ? 'alive in this pot' : hasPots ? 'in propagation' : 'alive'} to record.`
      }
      if (Number(deaths) > 0 && !deathCause.trim())
        next.deathCause = 'Say what caused the loss.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function quickLog(kind: 'watered' | 'fertilized') {
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in.')
      return
    }
    if (potted && !selectedPot) {
      setErrors((e) => ({ ...e, pot: 'Choose the pot first.' }))
      return
    }
    setBusy(true)
    setQuickPending(kind)
    try {
      const { error } = await supabase.from('date_logs').insert({
        experiment_id: experimentId,
        log_date: today(),
        status_details: '',
        deaths_count: 0,
        watered: kind === 'watered',
        fertilized: kind === 'fertilized',
        ...(potted ? { phase: 'potted' as const, pot_id: selectedPot!.id } : {}),
      })
      if (error) throw error
      navigate(backTo, {
        replace: true,
        state: {
          toast:
            kind === 'watered'
              ? 'Logged: watered today.'
              : 'Logged: fertilized today.',
          ...doneState,
        },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the quick log.',
      )
      setBusy(false)
      setQuickPending(null)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in.')
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      let imageUrl: string | null = currentUrl || null
      if (image) imageUrl = await uploadImage(image, user.id)

      const deathsN = deaths.trim() ? Number(deaths) : 0
      // The stage section saves as a unit: touch any of it and every bucket is
      // written (blank = 0); leave it alone and every bucket stays null.
      const stageFields = Object.fromEntries(
        STAGE_KEYS.map((k) => [
          k,
          stagesTouched ? (stages[k].trim() ? Number(stages[k]) : 0) : null,
        ]),
      )

      // The health tally saves as a unit, like the stage buckets: touch one and
      // all three are written (blank = 0); leave them all blank and all stay null.
      const healthTouched =
        health.good.trim() !== '' ||
        health.ok.trim() !== '' ||
        health.poor.trim() !== ''
      const healthFields = potted
        ? {
            health_good: healthTouched ? Number(health.good) || 0 : null,
            health_ok: healthTouched ? Number(health.ok) || 0 : null,
            health_poor: healthTouched ? Number(health.poor) || 0 : null,
          }
        : {}

      const fields = {
        log_date: logDate,
        status_details: statusDetails.trim(),
        image_url: imageUrl,
        ...stageFields,
        leafing_without_rooting: stagesTouched
          ? leafingNoRoot.trim()
            ? Number(leafingNoRoot)
            : 0
          : null,
        deaths_count: deathsN,
        death_cause: deathsN > 0 ? deathCause.trim() : null,
        ...(potted
          ? { phase: 'potted' as const, pot_id: selectedPot!.id, ...healthFields }
          : {}),
      }

      if (mode === 'edit' && initial) {
        const { error } = await supabase
          .from('date_logs')
          .update(fields)
          .eq('id', initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('date_logs')
          .insert({ experiment_id: experimentId, ...fields })
        if (error) throw error
      }

      navigate(backTo, {
        replace: true,
        state: { toast: successToast, ...doneState },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the log entry.',
      )
      setBusy(false)
    }
  }

  const previewSrc = newPreviewUrl ?? (currentUrl || null)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {mode === 'add' && (
        // Watering is logged folder-wide (it's the same for the whole batch);
        // fertilizer can differ per treatment, so it stays here.
        <QuickCareButtons
          onLog={(kind) => void quickLog(kind)}
          busy={busy}
          pending={quickPending}
          kinds={potted ? ['watered', 'fertilized'] : ['fertilized']}
          pot={potted && selectedPot ? { id: selectedPot.id, label: selectedPot.label } : undefined}
        />
      )}

      <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
        Date *
        <input
          type="date"
          value={logDate}
          max={today()}
          onChange={(e) => setLogDate(e.target.value)}
          className={inputClass}
        />
        {errors.logDate && (
          <span className="text-xs text-error">{errors.logDate}</span>
        )}
      </label>

      {potted && (
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Pot *
          <select
            value={potId}
            onChange={(e) => setPotId(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose a pot…</option>
            {sortedPots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {potAlive(phaseInput, p.id, undefined, {
                  excludeLogId: initial?.id,
                })}
                /{p.plant_count} alive
              </option>
            ))}
          </select>
          {errors.pot && <span className="text-xs text-error">{errors.pot}</span>}
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
        Notes
        <textarea
          rows={3}
          value={statusDetails}
          onChange={(e) => setStatusDetails(e.target.value)}
          placeholder="Batch notes for this check-in (optional)."
          className={inputClass}
        />
      </label>

      {!potted && (
      <>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
        <legend className="px-1 text-sm text-on-surface-variant">
          Root track
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {ROOT_STAGES.map((s) => (
            <label
              key={s.key}
              className="flex flex-col gap-1 text-xs text-on-surface-variant"
            >
              <span className="font-medium text-on-surface">{s.code}</span>
              <span className="min-h-8 leading-tight">{s.label}</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={stages[s.key]}
                onChange={(e) => setStage(s.key, e.target.value)}
                className={inputClass}
              />
              {errors[s.key] && (
                <span className="text-error">{errors[s.key]}</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
        <legend className="px-1 text-sm text-on-surface-variant">
          Leaf track
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {SHOOT_STAGES.map((s) => (
            <label
              key={s.key}
              className="flex flex-col gap-1 text-xs text-on-surface-variant"
            >
              <span className="font-medium text-on-surface">{s.code}</span>
              <span className="min-h-10 leading-tight">{s.label}</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={stages[s.key]}
                onChange={(e) => setStage(s.key, e.target.value)}
                className={inputClass}
              />
              {errors[s.key] && (
                <span className="text-error">{errors[s.key]}</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>
      </>
      )}

      <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
        <legend className="px-1 text-sm text-on-surface-variant">
          This check-in
        </legend>

        {potted && (
          <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Health of the plants in this pot
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['good', 'Good'],
                  ['ok', 'OK'],
                  ['poor', 'Poor'],
                ] as const
              ).map(([k, label]) => (
                <label
                  key={k}
                  className="flex flex-col gap-1 text-xs text-on-surface-variant"
                >
                  {label}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={health[k]}
                    onChange={(e) =>
                      setHealth((h) => ({ ...h, [k]: e.target.value }))
                    }
                    className={inputClass}
                  />
                  {errors[`health_${k}`] && (
                    <span className="text-error">{errors[`health_${k}`]}</span>
                  )}
                </label>
              ))}
            </div>
            {healthWarning && (
              <p className="flex items-start gap-1.5 text-xs">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-error" />
                <span>
                  {healthWarning} Saving is fine — just double-check the counts.
                </span>
              </p>
            )}
          </div>
        )}

        {!potted && (
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Leafing without rooting
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={leafingNoRoot}
            onChange={(e) => setLeafingNoRoot(e.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-on-surface-variant">
            Plants pushing a leaf (S1+) with no root yet (R0) — spending reserves
            they can't replace. Count them here; it can't be derived.
          </span>
          {errors.leafingNoRoot && (
            <span className="text-xs text-error">{errors.leafingNoRoot}</span>
          )}
        </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Dead / removed
            <input
              type="number"
              min={0}
              max={aliveBefore ?? undefined}
              step={1}
              inputMode="numeric"
              value={deaths}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setDeaths('')
                  return
                }
                const n = Number(raw)
                if (
                  aliveBefore != null &&
                  Number.isFinite(n) &&
                  n > aliveBefore
                ) {
                  setDeaths(String(aliveBefore))
                } else {
                  setDeaths(raw)
                }
              }}
              className={inputClass}
            />
            {aliveBefore != null && (
              <span className="text-xs text-on-surface-variant">
                {aliveBefore} still{' '}
                {potted ? 'alive in this pot' : hasPots ? 'in propagation' : 'alive'}
              </span>
            )}
            {errors.deaths && (
              <span className="text-xs text-error">{errors.deaths}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Cause
            <input
              type="text"
              list="death-cause-suggestions"
              value={deathCause}
              onChange={(e) => setDeathCause(e.target.value)}
              placeholder="e.g. rot"
              className={inputClass}
            />
            {errors.deathCause && (
              <span className="text-xs text-error">{errors.deathCause}</span>
            )}
          </label>
        </div>
        <datalist id="death-cause-suggestions">
          {DEATH_CAUSE_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </fieldset>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-error" />
              <span>{w}</span>
            </p>
          ))}
          <p className="text-on-surface-variant/70">
            Saving is fine — this is just a nudge to double-check the counts.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
        Photo
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => pickImage(e.target.files?.[0])}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => pickImage(e.target.files?.[0])}
          className="hidden"
        />
        {previewSrc ? (
          <div className="relative overflow-hidden rounded-lg ring-1 ring-outline-variant">
            <img
              src={previewSrc}
              alt="Photo preview"
              className="aspect-video w-full object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-1.5">
              {image && (
                <button
                  type="button"
                  onClick={() => setMarking(true)}
                  className="flex items-center gap-1 rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
                >
                  <Circle className="size-3.5 text-error" />
                  Circle
                </button>
              )}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove photo"
                className="rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              <Camera className="size-5" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant"
            >
              <ImagePlus className="size-5" />
              Choose from device
            </button>
          </div>
        )}
        {errors.image && (
          <span className="text-xs text-error">{errors.image}</span>
        )}
      </div>

      {marking && image && (
        <PhotoAnnotator
          file={image}
          onCancel={() => setMarking(false)}
          onDone={(marked) => {
            setImage(marked)
            setMarking(false)
          }}
        />
      )}

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
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy
            ? image
              ? 'Uploading photo…'
              : 'Saving…'
            : mode === 'edit'
              ? 'Save changes'
              : 'Save entry'}
        </button>
      </div>
    </form>
  )
}
