import { Bug, ChevronRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import PestDetailModal from '../components/PestDetailModal'
import { supabase } from '../lib/supabase'
import type { PestGuide } from '../types/database'

export default function PestControlPage() {
  const [guides, setGuides] = useState<PestGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PestGuide | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 15000)
    try {
      const { data, error } = await supabase
        .from('pest_guides')
        .select()
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)
      if (error) throw error
      setGuides(data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load pest guides.',
      )
    } finally {
      clearTimeout(abortTimer)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-medium text-on-surface">
        <Bug className="size-6 text-primary" />
        Pest Control
      </h1>

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
      ) : guides.length === 0 && !error ? (
        <div className="rounded-lg bg-surface-container px-4 py-16 text-center">
          <Bug className="mx-auto mb-3 size-10 text-on-surface-variant/50" />
          <p className="text-on-surface">No pest guides yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {guides.map((guide) => (
            <li key={guide.id}>
              <button
                type="button"
                onClick={() => setSelected(guide)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface-container px-4 py-3 text-left hover:opacity-90"
              >
                <span className="font-medium text-on-surface">
                  {guide.pest_name}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm text-on-surface-variant">
                  {guide.treatment_steps.length} step
                  {guide.treatment_steps.length === 1 ? '' : 's'}
                  <ChevronRight className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <PestDetailModal guide={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}
