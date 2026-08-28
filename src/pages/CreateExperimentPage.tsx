import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function CreateExperimentPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [titleError, setTitleError] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!title.trim()) {
      setTitleError('Name is required.')
      return
    }
    setTitleError('')

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
      const payload: Database['public']['Tables']['experiments']['Insert'] = {
        user_id: user.id,
        folder_id: folderId,
        title: title.trim(),
        notes: notes.trim() || null,
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
          {titleError && (
            <span className="text-xs text-error">{titleError}</span>
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
            {busy ? 'Saving…' : 'Save experiment'}
          </button>
        </div>
      </form>
    </section>
  )
}
