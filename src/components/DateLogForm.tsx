import { Camera, Circle, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhotoAnnotator from './PhotoAnnotator'
import QuickCareButtons from './QuickCareButtons'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import { DEATH_CAUSE_SUGGESTIONS } from '../lib/utils/survival'
import type { DateLog } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  experimentId: string
  mode: 'add' | 'edit'
  /** The row being edited (edit mode only). */
  initial?: DateLog
  /** Experiment's initial plant count, for the "plants still alive" cap. */
  plantCount: number | null
  /** Deaths logged in *other* entries — used to cap this entry's death count. */
  priorDeaths: number
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

export default function DateLogForm({
  experimentId,
  mode,
  initial,
  plantCount,
  priorDeaths,
  backTo,
  doneState,
  successToast,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [logDate, setLogDate] = useState(initial?.log_date ?? today())
  const [statusDetails, setStatusDetails] = useState(
    initial?.status_details ?? '',
  )
  const [rootLength, setRootLength] = useState(
    numOrEmpty(initial?.root_length_mm),
  )
  const [newLeaves, setNewLeaves] = useState(numOrEmpty(initial?.new_leaves))
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

  // How many plants may still be marked dead in this entry.
  const aliveBefore =
    plantCount == null ? null : Math.max(0, plantCount - priorDeaths)

  useEffect(() => {
    if (!image) {
      setNewPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(image)
    setNewPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

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

  function validate() {
    const next: Record<string, string> = {}
    if (!statusDetails.trim()) next.statusDetails = 'Status details are required.'
    if (!logDate) next.logDate = 'Pick a date.'
    else if (logDate > today()) next.logDate = 'Date cannot be in the future.'

    if (rootLength.trim()) {
      const n = Number(rootLength)
      if (Number.isNaN(n) || n < 0) next.rootLength = 'Enter a number ≥ 0.'
    }
    if (newLeaves.trim()) {
      const n = Number(newLeaves)
      if (!Number.isInteger(n) || n < 0)
        next.newLeaves = 'Enter a whole number ≥ 0.'
    }
    if (deaths.trim()) {
      const n = Number(deaths)
      if (!Number.isInteger(n) || n < 0) {
        next.deaths = 'Enter a whole number ≥ 0.'
      } else if (aliveBefore != null && n > aliveBefore) {
        next.deaths = `Only ${aliveBefore} plant${
          aliveBefore === 1 ? '' : 's'
        } still alive to record.`
      }
      if (n > 0 && !deathCause.trim())
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
      })
      if (error) throw error
      navigate(backTo, {
        replace: true,
        state: {
          toast: kind === 'watered' ? 'Logged: watered today.' : 'Logged: fertilized today.',
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
      const fields = {
        log_date: logDate,
        status_details: statusDetails.trim(),
        image_url: imageUrl,
        root_length_mm: rootLength.trim() ? Number(rootLength) : null,
        new_leaves: newLeaves.trim() ? Number(newLeaves) : null,
        deaths_count: deathsN,
        death_cause: deathsN > 0 ? deathCause.trim() : null,
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
        <QuickCareButtons
          onLog={(kind) => void quickLog(kind)}
          busy={busy}
          pending={quickPending}
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

      <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
        Status details *
        <textarea
          rows={4}
          value={statusDetails}
          onChange={(e) => setStatusDetails(e.target.value)}
          className={inputClass}
        />
        {errors.statusDetails && (
          <span className="text-xs text-error">{errors.statusDetails}</span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Root length (mm)
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={rootLength}
            onChange={(e) => setRootLength(e.target.value)}
            className={inputClass}
          />
          {errors.rootLength && (
            <span className="text-xs text-error">{errors.rootLength}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          New leaves
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={newLeaves}
            onChange={(e) => setNewLeaves(e.target.value)}
            className={inputClass}
          />
          {errors.newLeaves && (
            <span className="text-xs text-error">{errors.newLeaves}</span>
          )}
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
        <legend className="px-1 text-sm text-on-surface-variant">
          Plant losses
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Plants died
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
                // Never let this entry record more deaths than plants left alive.
                if (aliveBefore != null && Number.isFinite(n) && n > aliveBefore) {
                  setDeaths(String(aliveBefore))
                } else {
                  setDeaths(raw)
                }
              }}
              className={inputClass}
            />
            {aliveBefore != null && (
              <span className="text-xs text-on-surface-variant">
                {aliveBefore} still alive
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
