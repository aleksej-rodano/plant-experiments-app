import { Droplets, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { FeedingLog } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

const today = () => new Date().toISOString().slice(0, 10)

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function SeasonGuide() {
  return (
    <div className="mb-6 rounded-lg bg-surface-container px-4 py-3 text-sm text-on-surface">
      <h2 className="mb-2 font-medium text-on-surface-variant">
        Feeding frequency by season
      </h2>
      <ul className="flex flex-col gap-1.5">
        <li>
          <span className="font-medium">Spring &amp; summer</span> — every 2–4
          weeks while the plant is putting out new growth.
        </li>
        <li>
          <span className="font-medium">Autumn</span> — stretch to every 4–6
          weeks as growth slows.
        </li>
        <li>
          <span className="font-medium">Winter</span> — usually none; feed only
          plants that are visibly still growing, at half strength.
        </li>
      </ul>
      <p className="mt-2 text-on-surface-variant">
        Always feed onto damp soil, never bone-dry roots, and skip a stressed or
        newly repotted plant.
      </p>
    </div>
  )
}

export default function FertilizerLogPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<FeedingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fedOn, setFedOn] = useState(today)
  const [notes, setNotes] = useState('')
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
        .from('feeding_logs')
        .select()
        .order('fed_on', { ascending: false })
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (error) throw error
      setEntries(data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load the feeding log.',
      )
    } finally {
      clearTimeout(abortTimer)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!fedOn) {
      setFormError('Pick a date.')
      return
    }
    if (!user) {
      setFormError('You must be signed in.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('feeding_logs')
        .insert({ user_id: user.id, fed_on: fedOn, notes: notes.trim() || null })
        .select()
        .single()
      if (error) throw error
      setEntries((prev) =>
        [data, ...prev].sort((a, b) =>
          a.fed_on === b.fed_on
            ? b.created_at.localeCompare(a.created_at)
            : b.fed_on.localeCompare(a.fed_on),
        ),
      )
      setNotes('')
      setFedOn(today())
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not save the entry.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('feeding_logs').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setEntries((prev) => prev.filter((x) => x.id !== id))
    setPendingDelete(null)
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-medium text-on-surface">
        <Droplets className="size-6 text-primary" />
        Fertilizer Log
      </h1>

      <SeasonGuide />

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-col gap-3 rounded-lg bg-surface-container p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Date
            <input
              type="date"
              value={fedOn}
              max={today()}
              onChange={(e) => setFedOn(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-on-surface-variant">
            Notes (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. half-strength, all folders"
              className={inputClass}
            />
          </label>
        </div>
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
          {busy ? 'Saving…' : 'Add entry'}
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
      ) : entries.length === 0 && !error ? (
        <p className="rounded-lg bg-surface-container px-3 py-10 text-center text-sm text-on-surface-variant">
          No feeding entries yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-surface-container px-4 py-3"
            >
              <div className="min-w-0">
                <time className="text-sm font-medium text-on-surface">
                  {formatDate(entry.fed_on)}
                </time>
                {entry.notes && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-on-surface-variant">
                    {entry.notes}
                  </p>
                )}
              </div>
              {pendingDelete === entry.id ? (
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
                    onClick={() => void handleDelete(entry.id)}
                    className="rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error"
                  >
                    Delete
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDelete(entry.id)}
                  aria-label="Delete entry"
                  className="shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
