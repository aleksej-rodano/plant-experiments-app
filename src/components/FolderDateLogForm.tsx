import { Circle, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhotoAnnotator from './PhotoAnnotator'
import QuickCareButtons from './QuickCareButtons'
import { useAuth } from '../lib/hooks/useAuth'
import { syncCareNotifications } from '../lib/native'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Experiment } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  /** Experiments the entry will be written to (one date_logs row each). */
  experiments: Experiment[]
  /** Parent folder — its care reminder is reset when the entry is saved. */
  folderId?: string
  /** Where to go after a successful save / cancel. */
  backTo: string
  /** Extra router state to carry back (e.g. the folder). */
  doneState?: Record<string, unknown>
}

/**
 * Writes ONE shared log entry to every experiment in a folder — for chores you
 * do to the whole batch at once (water change, fertilizer). Each experiment gets
 * its own `date_logs` row, so the entry shows up in every individual timeline.
 *
 * Deliberately slimmer than DateLogForm: no per-plant fields (root length, new
 * leaves, deaths) since those only make sense one experiment at a time.
 */
export default function FolderDateLogForm({
  experiments,
  folderId,
  backTo,
  doneState,
}: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [logDate, setLogDate] = useState(today())
  const [statusDetails, setStatusDetails] = useState('')

  const [image, setImage] = useState<File | null>(null)
  const [marking, setMarking] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quickPending, setQuickPending] = useState<
    'watered' | 'fertilized' | null
  >(null)

  const count = experiments.length

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
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
    if (fileRef.current) fileRef.current.value = ''
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!statusDetails.trim())
      next.statusDetails = 'Write what you did (e.g. "Changed water").'
    if (!logDate) next.logDate = 'Pick a date.'
    else if (logDate > today()) next.logDate = 'Date cannot be in the future.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function quickLog(kind: 'watered' | 'fertilized') {
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in.')
      return
    }
    if (count === 0) {
      setSubmitError('This folder has no experiments to log against yet.')
      return
    }
    setBusy(true)
    setQuickPending(kind)
    try {
      const rows = experiments.map((exp) => ({
        experiment_id: exp.id,
        log_date: today(),
        status_details: '',
        deaths_count: 0,
        watered: kind === 'watered',
        fertilized: kind === 'fertilized',
      }))
      const { error } = await supabase.from('date_logs').insert(rows)
      if (error) throw error

      // The folder reminder tracks the water change, so a "watered" entry
      // resets its clock; "fertilized" is a different chore and leaves it alone.
      if (folderId && kind === 'watered') {
        await supabase
          .from('folders')
          .update({ care_last_done_on: today() })
          .eq('id', folderId)
        void syncCareNotifications()
      }

      navigate(backTo, {
        replace: true,
        state: {
          toast:
            kind === 'watered'
              ? `Watered — logged to ${count} experiment${count === 1 ? '' : 's'}.`
              : `Fertilized — logged to ${count} experiment${count === 1 ? '' : 's'}.`,
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
    if (count === 0) {
      setSubmitError('This folder has no experiments to log against yet.')
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      // Upload the photo once and reuse the URL across every row.
      let imageUrl: string | null = null
      if (image) imageUrl = await uploadImage(image, user.id)

      const details = statusDetails.trim()
      const rows = experiments.map((exp) => ({
        experiment_id: exp.id,
        log_date: logDate,
        status_details: details,
        image_url: imageUrl,
        deaths_count: 0,
      }))

      const { error } = await supabase.from('date_logs').insert(rows)
      if (error) throw error

      // Doing the whole folder at once is exactly the chore the reminder tracks,
      // so reset its clock. A failure here shouldn't lose the entry that saved.
      if (folderId) {
        await supabase
          .from('folders')
          .update({ care_last_done_on: logDate })
          .eq('id', folderId)
        void syncCareNotifications()
      }

      navigate(backTo, {
        replace: true,
        state: {
          toast: `Log added to ${count} experiment${count === 1 ? '' : 's'}.`,
          ...doneState,
        },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save the log entry.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {count > 0 && (
        <QuickCareButtons
          onLog={(kind) => void quickLog(kind)}
          busy={busy}
          pending={quickPending}
        />
      )}

      <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
        {count === 0 ? (
          'No experiments in this folder yet.'
        ) : (
          <>
            This entry will be added to all{' '}
            <span className="font-medium text-on-surface">{count}</span>{' '}
            experiment{count === 1 ? '' : 's'} in the folder:{' '}
            {experiments.map((e) => e.title).join(', ')}.
          </>
        )}
      </p>

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
        What did you do? *
        <textarea
          rows={3}
          value={statusDetails}
          onChange={(e) => setStatusDetails(e.target.value)}
          placeholder="e.g. Changed the water. / Added fertilizer at half strength."
          className={inputClass}
        />
        {errors.statusDetails && (
          <span className="text-xs text-error">{errors.statusDetails}</span>
        )}
      </label>

      <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
        Photo (optional)
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => pickImage(e.target.files?.[0])}
          className="hidden"
        />
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-lg ring-1 ring-outline-variant">
            <img
              src={previewUrl}
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
                onClick={() => fileRef.current?.click()}
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant"
          >
            <ImagePlus className="size-5" />
            Choose JPG or PNG
          </button>
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
          disabled={busy || count === 0}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy
            ? image
              ? 'Uploading photo…'
              : 'Saving…'
            : `Add to ${count || 'all'} experiment${count === 1 ? '' : 's'}`}
        </button>
      </div>
    </form>
  )
}
