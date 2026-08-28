import { ChevronDown, Lightbulb, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Tip } from '../types/database'

export default function TipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 15000)
    try {
      const { data, error } = await supabase
        .from('tips')
        .select()
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)
      if (error) throw error
      setTips(data ?? [])
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load tips.',
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
        <Lightbulb className="size-6 text-primary" />
        Tips
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
      ) : tips.length === 0 && !error ? (
        <div className="rounded-lg bg-surface-container px-4 py-16 text-center">
          <Lightbulb className="mx-auto mb-3 size-10 text-on-surface-variant/50" />
          <p className="text-on-surface">No tips yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tips.map((tip) => {
            const open = expanded === tip.id
            return (
              <li
                key={tip.id}
                className="overflow-hidden rounded-lg bg-surface-container"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : tip.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="font-medium text-on-surface">{tip.title}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-on-surface-variant transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {open && (
                  <p className="whitespace-pre-wrap px-4 pb-4 text-sm text-on-surface-variant">
                    {tip.content}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
