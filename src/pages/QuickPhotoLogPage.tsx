import { ArrowLeft, Camera, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Experiment, Folder } from '../types/database'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * The fast path for the common case: a photo *is* the update. Shoot, save, done —
 * the note is optional and everything else defaults. Entries land in the same
 * `date_logs` table as a full entry, so they show up in the normal timeline and
 * can be filled in later by editing.
 */
export default function QuickPhotoLogPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const navState = location.state as {
    experiment?: Experiment
    folder?: Folder
  } | null

  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [logDate, setLogDate] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const backTo = id ? `/experiments/${id}` : '/experiments'

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
      setError(problem)
      return
    }
    setError(null)
    setImage(file)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    if (!user) {
      setError('You must be signed in.')
      return
    }
    if (!image) {
      setError('Add a photo first.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const imageUrl = await uploadImage(image, user.id)
      // Empty rather than null: status_details is NOT NULL, and the timeline
      // simply renders nothing for a photo-only entry.
      const { error: insertError } = await supabase.from('date_logs').insert({
        experiment_id: id,
        log_date: logDate,
        status_details: note.trim(),
        image_url: imageUrl,
        deaths_count: 0,
      })
      if (insertError) throw insertError

      navigate(backTo, {
        replace: true,
        state: {
          toast: 'Photo logged.',
          experiment: navState?.experiment,
          folder: navState?.folder,
        },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the photo entry.',
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
          aria-label="Back to experiment"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Quick photo</h1>
      </div>

      {navState?.experiment && (
        <p className="mb-4 text-sm text-on-surface-variant">
          {navState.experiment.title}
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!id ? (
        <p className="text-sm text-error">Missing experiment id.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
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
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg bg-surface/80 px-2 py-1.5 text-xs font-medium text-on-surface-variant backdrop-blur hover:bg-surface"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImage(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  aria-label="Remove photo"
                  className="rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            // The whole point of this screen: one big target, nothing else to fill in.
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-outline px-4 py-16 text-on-surface-variant hover:bg-surface-variant"
            >
              <Camera className="size-10" />
              <span className="text-base font-medium">Take a photo</span>
              <span className="text-xs">or choose one from your device</span>
            </button>
          )}

          {image && (
            <>
              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                Note (optional)
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Leave blank to save just the photo."
                  className="rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                Date
                <input
                  type="date"
                  value={logDate}
                  max={today()}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                />
              </label>
            </>
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
              disabled={busy || !image}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Uploading…' : 'Save photo'}
            </button>
          </div>

          <p className="text-center text-xs text-on-surface-variant">
            Need root length, leaves or losses?{' '}
            <Link
              to={`/experiments/${id}/logs/new`}
              state={navState}
              className="underline"
            >
              Use the full log form
            </Link>
            .
          </p>
        </form>
      )}
    </section>
  )
}
