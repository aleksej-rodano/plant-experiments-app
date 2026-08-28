import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

const ACCEPTED = ['image/jpeg', 'image/png']
const MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'experiment-photos'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function CreateExperimentPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [plantCount, setPlantCount] = useState('')
  const [origin, setOrigin] = useState('')
  const [initialPrice, setInitialPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    if (!ACCEPTED.includes(file.type)) {
      setErrors((e) => ({ ...e, image: 'Use a JPG or PNG image.' }))
      return
    }
    if (file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, image: 'Image must be 5MB or smaller.' }))
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
    if (!title.trim()) next.title = 'Title is required.'
    const count = Number(plantCount)
    if (!plantCount.trim()) next.plantCount = 'Plant count is required.'
    else if (!Number.isInteger(count) || count < 1)
      next.plantCount = 'Enter a whole number of at least 1.'
    if (!origin.trim()) next.origin = 'Origin is required.'
    if (initialPrice.trim() && Number(initialPrice) < 0)
      next.initialPrice = 'Price cannot be negative.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function uploadCover(userId: string): Promise<string> {
    if (!image) return ''
    const ext = image.type === 'image/png' ? 'png' : 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, image, { contentType: image.type })
    if (error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in to create an experiment.')
      return
    }
    if (!validate()) return

    setBusy(true)
    try {
      const coverUrl = await uploadCover(user.id)
      const payload: Database['public']['Tables']['experiments']['Insert'] = {
        user_id: user.id,
        title: title.trim(),
        plant_count: Number(plantCount),
        origin: origin.trim(),
        initial_price: initialPrice.trim() ? Number(initialPrice) : null,
        notes: notes.trim() || null,
        cover_image_url: coverUrl || null,
      }
      const { error } = await supabase.from('experiments').insert(payload)
      if (error) throw error
      navigate('/experiments', {
        replace: true,
        state: { toast: 'Experiment created.' },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save experiment.')
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to="/experiments"
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
          aria-label="Back to experiments"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">New Experiment</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Title (plant species) *
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          {errors.title && <span className="text-xs text-error">{errors.title}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Plant count *
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
          Origin (where purchased) *
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className={inputClass}
          />
          {errors.origin && <span className="text-xs text-error">{errors.origin}</span>}
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
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Cover image
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
                alt="Cover preview"
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove image"
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
              Choose JPG or PNG (max 5MB)
            </button>
          )}
          {errors.image && <span className="text-xs text-error">{errors.image}</span>}
        </div>

        {submitError && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            to="/experiments"
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
            Save experiment
          </button>
        </div>
      </form>
    </section>
  )
}
