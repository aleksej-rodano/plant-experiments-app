import { Lightbulb, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Tip } from '../types/database'

// The chip row, in this order. Only these categories are shown — a tip with any
// other (or missing) category is left out rather than dumped in an "Other" chip.
const CATEGORY_ORDER = [
  'Cuttings',
  'Rooting',
  'Environment & timing',
  'Method & fixes',
  'Pothos & Monstera',
]

/**
 * Render a tip body. Lines that start with a dash/bullet are laid out as a
 * flex row with the marker in its own column, so wrapped text hangs under the
 * first word instead of sliding back to the left margin.
 */
function TipContent({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm text-on-surface-variant">
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[-•*]\s+(.*)$/.exec(line)
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span aria-hidden className="shrink-0 select-none">
                •
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {bullet[1]}
              </span>
            </div>
          )
        }
        if (line.trim() === '') {
          return <span key={i} aria-hidden className="block h-1.5" />
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        )
      })}
    </div>
  )
}

interface Category {
  name: string
  tips: Tip[]
}

/** Bucket the flat tip list by category, keeping load order within each. */
function groupTips(tips: Tip[]): Category[] {
  const map = new Map<string, Tip[]>()
  for (const tip of tips) {
    if (!tip.category || !CATEGORY_ORDER.includes(tip.category)) continue
    if (!map.has(tip.category)) map.set(tip.category, [])
    map.get(tip.category)!.push(tip)
  }
  return CATEGORY_ORDER.filter((n) => map.has(n)).map((name) => ({
    name,
    tips: map.get(name)!,
  }))
}

export default function TipsPage() {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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
      // "Hydrogen Peroxide Dilution" is covered by the Pest Control protocols now.
      setTips(
        (data ?? []).filter((t) => t.title !== 'Hydrogen Peroxide Dilution'),
      )
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

  const categories = useMemo(() => groupTips(tips), [tips])

  // Fall back to the first category until one is tapped.
  const current =
    categories.find((c) => c.name === activeCategory) ?? categories[0] ?? null

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
      ) : categories.length === 0 && !error ? (
        <div className="rounded-lg bg-surface-container px-4 py-16 text-center">
          <Lightbulb className="mx-auto mb-3 size-10 text-on-surface-variant/50" />
          <p className="text-on-surface">No tips yet.</p>
        </div>
      ) : (
        <>
          {/* Categories — wrap onto as many lines as needed so all are visible
              at once; tap one to open its tips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setActiveCategory(c.name)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  c.name === current?.name
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* All tips for the open category, stacked. Each gets a large heading
              and is split from the next by a thick rule. */}
          {current && (
            <div className="overflow-hidden rounded-lg bg-surface-container">
              {current.tips.map((tip, i) => (
                <article
                  key={tip.id}
                  className={
                    i > 0 ? 'border-t-4 border-outline px-4 py-4' : 'px-4 py-4'
                  }
                >
                  <h2 className="mb-2 text-lg font-bold text-on-surface">
                    {tip.title}
                  </h2>
                  <TipContent text={tip.content} />
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
