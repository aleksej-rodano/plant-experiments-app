import { Loader2, Plus, Sprout } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ExperimentCard from '../components/ExperimentCard'
import { supabase } from '../lib/supabase'
import type { Experiment } from '../types/database'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('experiments')
      .select()
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setExperiments(data ?? [])
    setLoading(false)
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
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
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
