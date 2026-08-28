import { CheckCircle2, Loader2, Plus, Sprout } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ExperimentCard from '../components/ExperimentCard'
import { supabase } from '../lib/supabase'
import type { Experiment } from '../types/database'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (!state?.toast) return
    setToast(state.toast)
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [location.state, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setSlow(false)
    setError(null)

    const controller = new AbortController()
    const slowTimer = setTimeout(() => setSlow(true), 4000)
    const abortTimer = setTimeout(() => controller.abort(), 15000)

    try {
      const { data, error } = await supabase
        .from('experiments')
        .select()
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (error) throw error
      setExperiments(data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load experiments.',
      )
    } finally {
      clearTimeout(slowTimer)
      clearTimeout(abortTimer)
      setSlow(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(id: string) {
    const { error } = await supabase.from('experiments').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setExperiments((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-medium text-on-surface">
          <Sprout className="size-6 text-primary" />
          Experiments
        </h1>
        <Link
          to="/experiments/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">New Experiment</span>
        </Link>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

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
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          {slow && (
            <p className="text-sm text-on-surface-variant">
              Still loading — your connection to the server seems slow.
            </p>
          )}
        </div>
      ) : experiments.length === 0 && !error ? (
        <div className="rounded-lg bg-surface-container px-4 py-16 text-center">
          <Sprout className="mx-auto mb-3 size-10 text-on-surface-variant/50" />
          <p className="text-on-surface">No experiments yet.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Create your first experiment to start tracking.
          </p>
          <Link
            to="/experiments/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus className="size-4" />
            New Experiment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {experiments.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}
