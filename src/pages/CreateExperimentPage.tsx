import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Database } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

export default function CreateExperimentPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [plantCount, setPlantCount] = useState('')
  const [startedOn, setStartedOn] = useState(today)
  const [notes, setNotes] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<{
    title?: string
    plantCount?: string
    startedOn?: string
    image?: string
  }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

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
    setErrors((e) => ({ ...e, image: undefined }))
    setImage(file)
  }

  function clearImage() {
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const nextErrors: {
      title?: string
      plantCount?: string
      startedOn?: string
    } = {}
    if (!title.trim()) nextErrors.title = 'Name is required.'
    const count = Number(plantCount)
    if (!plantCount.trim()) nextErrors.plantCount = 'Plant count is required.'
    else if (!Number.isInteger(count) || count < 1)
      nextErrors.plantCount = 'Enter a whole number of at least 1.'
    if (!startedOn) nextErrors.startedOn = 'Pick a start date.'
    else if (startedOn > today())
      nextErrors.startedOn = 'Start date cannot be in the future.'
    setErrors((prev) => ({ ...prev, ...nextErrors }))
    if (Object.keys(nextErrors).length > 0) return

    if (!folderId) {
      setSubmitError('Missing folder id.')
      return
    }
    if (!user) {
      setSubmitError('You must be signed in to create an experiment.')
      return
    }

    setBusy(true)
    try {
      const coverUrl = image ? await uploadImage(image, user.id) : null
      const payload: Database['public']['Tables']['experiments']['Insert'] = {
        user_id: user.id,
        folder_id: folderId,
        title: title.trim(),
        plant_count: Number(plantCount),
        started_on: startedOn,
        notes: notes.trim() || null,
        cover_image_url: coverUrl,
      }
      const { error } = await supabase.from('experiments').insert(payload)
      if (error) throw error
      navigate(backTo, {
        replace: true,
        state: { toast: 'Experiment created.' },
      })
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save experiment.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={backTo}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
          aria-label="Back to folder"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">New Experiment</h1>
      </div>

      <p className="mb-4 rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
        An experiment is one treatment you run on this folder's batch — name it
        for what you changed, then track it over time with log entries.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Name (what you changed) *
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. rooting powder, smaller cuttings"
            className={inputClass}
          />
          {errors.title && (
            <span className="text-xs text-error">{errors.title}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Plant count (plants in this experiment) *
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
          Notes
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Initial photo
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
                alt="Initial photo preview"
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove photo"
                className="absolute right-2 top-2 rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
              >
                <X className="size-4" />
              </button>
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
            {busy ? (image ? 'Uploading photo…' : 'Saving…') : 'Save experiment'}
          </button>
        </div>
      </form>
    </section>
  )
}
