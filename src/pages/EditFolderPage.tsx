import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { CARE_TASK_SUGGESTIONS } from '../lib/utils/care'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Database, Folder } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function EditFolderPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const seeded = (location.state as { folder?: Folder } | null)?.folder ?? null

  const [folder, setFolder] = useState<Folder | null>(seeded)
  const [loading, setLoading] = useState(!seeded)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState(seeded?.title ?? '')
  const [origin, setOrigin] = useState(seeded?.origin ?? '')
  const [initialPrice, setInitialPrice] = useState(
    seeded?.initial_price != null ? String(seeded.initial_price) : '',
  )
  const [notes, setNotes] = useState(seeded?.notes ?? '')
  const [careTask, setCareTask] = useState(seeded?.care_task_label ?? '')
  const [careInterval, setCareInterval] = useState(
    seeded?.care_interval_days != null ? String(seeded.care_interval_days) : '',
  )
  // Image state: `image` is a newly picked file; `currentUrl` is what's stored;
  // clearing sets `currentUrl` to '' so we know to null it out on save.
  const [image, setImage] = useState<File | null>(null)
  const [currentUrl, setCurrentUrl] = useState(seeded?.cover_image_url ?? '')
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

  // Fetch the folder when we weren't handed it via route state.
  useEffect(() => {
    if (seeded || !folderId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('folders')
        .select()
        .eq('id', folderId)
        .is('deleted_at', null)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
      } else if (!data) {
        setLoadError('Folder not found.')
      } else {
        setFolder(data)
        setTitle(data.title)
        setOrigin(data.origin ?? '')
        setInitialPrice(
          data.initial_price != null ? String(data.initial_price) : '',
        )
        setNotes(data.notes ?? '')
        setCareTask(data.care_task_label ?? '')
        setCareInterval(
          data.care_interval_days != null ? String(data.care_interval_days) : '',
        )
        setCurrentUrl(data.cover_image_url ?? '')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [seeded, folderId])

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
    if (!title.trim()) next.title = 'Title is required.'
    if (initialPrice.trim() && Number(initialPrice) < 0)
      next.initialPrice = 'Price cannot be negative.'
    if (careInterval.trim()) {
      const n = Number(careInterval)
      if (!Number.isInteger(n) || n < 1)
        next.careInterval = 'Enter a whole number of days, 1 or more.'
      else if (!careTask.trim())
        next.careTask = 'Name the task you want reminding about.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in to edit a folder.')
      return
    }
    if (!folderId) {
      setSubmitError('Missing folder id.')
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      let coverUrl: string | null = currentUrl || null
      if (image) coverUrl = await uploadImage(image, user.id)

      const payload: Database['public']['Tables']['folders']['Update'] = {
        title: title.trim(),
        origin: origin.trim() || null,
        initial_price: initialPrice.trim() ? Number(initialPrice) : null,
        notes: notes.trim() || null,
        cover_image_url: coverUrl,
        // Clearing the interval turns the reminder off entirely.
        care_task_label: careInterval.trim() ? careTask.trim() || null : null,
        care_interval_days: careInterval.trim() ? Number(careInterval) : null,
      }
      const { error } = await supabase
        .from('folders')
        .update(payload)
        .eq('id', folderId)
      if (error) throw error
      navigate(backTo, {
        replace: true,
        state: { toast: 'Folder updated.' },
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

  if (loadError || !folder) {
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
          {loadError ?? 'Folder not found.'}
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
          aria-label="Back to folder"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Edit Folder</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Title (plant species / batch name) *
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
          Origin (where purchased)
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Initial price
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={initialPrice}
            onChange={(e) => setInitialPrice(e.target.value)}
            className={inputClass}
          />
          {errors.initialPrice && (
            <span className="text-xs text-error">{errors.initialPrice}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Description / notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
          <legend className="px-1 text-sm text-on-surface-variant">
            Recurring reminder
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Task
              <input
                type="text"
                list="care-task-suggestions"
                value={careTask}
                onChange={(e) => setCareTask(e.target.value)}
                placeholder="e.g. Change water"
                className={inputClass}
              />
              {errors.careTask && (
                <span className="text-xs text-error">{errors.careTask}</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
              Every … days
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={careInterval}
                onChange={(e) => setCareInterval(e.target.value)}
                placeholder="3"
                className={inputClass}
              />
              {errors.careInterval && (
                <span className="text-xs text-error">{errors.careInterval}</span>
              )}
            </label>
          </div>
          <datalist id="care-task-suggestions">
            {CARE_TASK_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p className="text-xs text-on-surface-variant">
            Leave the days blank to turn the reminder off.
          </p>
        </fieldset>

        <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Cover image
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
                  aria-label="Remove image"
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
