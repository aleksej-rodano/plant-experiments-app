import { ImagePlus, Loader2, NotebookPen, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { binRow } from '../lib/utils/bin'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { Note } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 15000)
    try {
      const { data, error } = await supabase
        .from('notes')
        .select()
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (error) throw error
      setNotes(data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load notes.',
      )
    } finally {
      clearTimeout(abortTimer)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
      setFormError(problem)
      return
    }
    setFormError(null)
    setImage(file)
  }

  function clearImage() {
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!body.trim()) {
      setFormError('Write something first.')
      return
    }
    if (!user) {
      setFormError('You must be signed in.')
      return
    }
    setBusy(true)
    try {
      const imageUrl = image ? await uploadImage(image, user.id) : null
      const { data, error } = await supabase
        .from('notes')
        .insert({ user_id: user.id, body: body.trim(), image_url: imageUrl })
        .select()
        .single()
      if (error) throw error
      setNotes((prev) => [data, ...prev])
      setBody('')
      clearImage()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the note.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await binRow('note', id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the note.')
      return
    }
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setPendingDelete(null)
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-medium text-on-surface">
        <NotebookPen className="size-6 text-primary" />
        Notes
      </h1>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-col gap-3 rounded-lg bg-surface-container p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          New note
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Anything worth remembering…"
            className={inputClass}
          />
        </label>

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
              alt="Note attachment preview"
              className="max-h-64 w-full object-cover"
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
            className="flex items-center justify-center gap-2 self-start rounded-lg border border-dashed border-outline px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-variant"
          >
            <ImagePlus className="size-4" />
            Add photo
          </button>
        )}

        {formError && <p className="text-xs text-error">{formError}</p>}

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {busy ? (image ? 'Uploading photo…' : 'Saving…') : 'Add note'}
        </button>
      </form>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : notes.length === 0 && !error ? (
        <p className="rounded-lg bg-surface-container px-3 py-10 text-center text-sm text-on-surface-variant">
          No notes yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg bg-surface-container px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <time className="text-xs font-medium text-on-surface-variant">
                  {formatDate(note.created_at)}
                </time>
                {pendingDelete === note.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-variant"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(note.id)}
                      className="rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error"
                    >
                      Delete
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(note.id)}
                    aria-label="Delete note"
                    className="shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">
                {note.body}
              </p>
              {note.image_url && (
                <img
                  src={note.image_url}
                  alt="Note attachment"
                  className="mt-2 max-h-72 rounded-lg object-cover ring-1 ring-outline-variant"
                  loading="lazy"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
