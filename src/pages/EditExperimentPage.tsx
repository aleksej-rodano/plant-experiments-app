import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type {
  Database,
  Experiment,
  ExperimentStatus,
} from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_OPTIONS: { value: ExperimentStatus; label: string }[] = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
]

export default function EditExperimentPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const seeded =
    (location.state as { experiment?: Experiment } | null)?.experiment ?? null

  const [loading, setLoading] = useState(!seeded)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState(seeded?.title ?? '')
  const [plantCount, setPlantCount] = useState(
    seeded?.plant_count != null ? String(seeded.plant_count) : '',
  )
  const [startedOn, setStartedOn] = useState(seeded?.started_on ?? today())
  const [status, setStatus] = useState<ExperimentStatus>(
    seeded?.status ?? 'ongoing',
  )
  const [notes, setNotes] = useState(seeded?.notes ?? '')
  const [image, setImage] = useState<File | null>(null)
  const [currentUrl, setCurrentUrl] = useState(seeded?.cover_image_url ?? '')
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backTo = id ? `/experiments/${id}` : '/experiments'

  useEffect(() => {
    if (seeded || !id) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('experiments')
        .select()
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
      } else if (!data) {
        setLoadError('Experiment not found.')
      } else {
        setTitle(data.title)
        setPlantCount(data.plant_count != null ? String(data.plant_count) : '')
        setStartedOn(data.started_on ?? today())
        setStatus(data.status ?? 'ongoing')
        setNotes(data.notes ?? '')
        setCurrentUrl(data.cover_image_url ?? '')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [seeded, id])

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
    if (fileRef.current) fileRef.current.value = ''
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = 'Name is required.'
    const count = Number(plantCount)
    if (!plantCount.trim()) next.plantCount = 'Plant count is required.'
    else if (!Number.isInteger(count) || count < 1)
      next.plantCount = 'Enter a whole number of at least 1.'
    if (!startedOn) next.startedOn = 'Pick a start date.'
    else if (startedOn > today())
      next.startedOn = 'Start date cannot be in the future.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in to edit an experiment.')
      return
    }
    if (!id) {
      setSubmitError('Missing experiment id.')
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      let coverUrl: string | null = currentUrl || null
      if (image) coverUrl = await uploadImage(image, user.id)

      const payload: Database['public']['Tables']['experiments']['Update'] = {
        title: title.trim(),
        plant_count: Number(plantCount),
        started_on: startedOn,
        status,
        notes: notes.trim() || null,
        cover_image_url: coverUrl,
      }
      const { error } = await supabase
        .from('experiments')
        .update(payload)
        .eq('id', id)
      if (error) throw error
      navigate(backTo, {
        replace: true,
        state: { toast: 'Experiment updated.' },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save changes.',
      )
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (loadError) {
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
          {loadError}
        </p>
      </section>
    )
  }

  const previewSrc = newPreviewUrl ?? (currentUrl || null)

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
        <h1 className="text-xl font-medium text-on-surface">Edit Experiment</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Name (what you changed) *
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          {errors.title && (
            <span className="text-xs text-error">{errors.title}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Plant count (initial number of plants) *
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={plantCount}
            onChange={(e) => setPlantCount(e.target.value)}
            className={inputClass}
          />
          {errors.plantCount && (
            <span className="text-xs text-error">{errors.plantCount}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Start date *
          <input
            type="date"
            value={startedOn}
            max={today()}
            onChange={(e) => setStartedOn(e.target.value)}
            className={inputClass}
          />
          {errors.startedOn && (
            <span className="text-xs text-error">{errors.startedOn}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ExperimentStatus)}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Notes
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Cover photo
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => pickImage(e.target.files?.[0])}
            className="hidden"
          />
          {previewSrc ? (
            <div className="relative overflow-hidden rounded-lg ring-1 ring-outline-variant">
              <img
                src={previewSrc}
                alt="Cover preview"
                className="aspect-video w-full object-cover"
              />
              <div className="absolute right-2 top-2 flex gap-1.5">
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
            {busy ? (image ? 'Uploading photo…' : 'Saving…') : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}
