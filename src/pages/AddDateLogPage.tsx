import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Experiment } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

export default function AddDateLogPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const experiment = (location.state as { experiment?: Experiment } | null)?.experiment

  const [logDate, setLogDate] = useState(today)
  const [statusDetails, setStatusDetails] = useState('')
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const next: Record<string, string> = {}
    if (!statusDetails.trim()) next.statusDetails = 'Status details are required.'
    if (!logDate) next.logDate = 'Pick a date.'
    setErrors((prev) => ({ ...prev, ...next }))
    if (Object.keys(next).length > 0) return

    if (!id) {
      setSubmitError('Missing experiment id.')
      return
    }
    if (!user) {
      setSubmitError('You must be signed in.')
      return
    }

    setBusy(true)
    try {
      const imageUrl = image ? await uploadImage(image, user.id) : null
      // One round trip: insert and read the row back, then hand both the
      // experiment (from route state) and the new log to the detail page so
      // it renders with zero further requests.
      const { data, error } = await supabase
        .from('date_logs')
        .insert({
          experiment_id: id,
          log_date: logDate,
          status_details: statusDetails.trim(),
          image_url: imageUrl,
        })
        .select()
        .single()
      if (error) throw error
      navigate(`/experiments/${id}`, {
        replace: true,
        state: { toast: 'Log entry added.', experiment, newLog: data },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save log entry.')
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={id ? `/experiments/${id}` : '/experiments'}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
          aria-label="Back to experiment"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Add Log Entry</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Date *
          <input
            type="date"
            value={logDate}
            max={today()}
            onChange={(e) => setLogDate(e.target.value)}
            className={inputClass}
          />
          {errors.logDate && <span className="text-xs text-error">{errors.logDate}</span>}
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

        <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Photo
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
          {errors.image && <span className="text-xs text-error">{errors.image}</span>}
        </div>

        {submitError && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            to={id ? `/experiments/${id}` : '/experiments'}
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
            {busy ? (image ? 'Uploading photo…' : 'Saving…') : 'Save entry'}
          </button>
        </div>
      </form>
    </section>
  )
}
