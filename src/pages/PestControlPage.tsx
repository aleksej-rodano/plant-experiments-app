import { Bug, ChevronDown, ImagePlus, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import PestTreatmentGuide, {
  hasPestProtocol,
} from '../components/PestTreatmentGuide'
import { useAuth } from '../lib/hooks/useAuth'
import { supabase } from '../lib/supabase'
import { uploadImage, validateImage } from '../lib/utils/image'
import type { PestGuide } from '../types/database'

function PestPhoto({
  guide,
  onImage,
}: {
  guide: PestGuide
  onImage: (id: string, url: string) => void
}) {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file || !user) return
    const problem = validateImage(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const url = await uploadImage(file, user.id)
      const { error } = await supabase
        .from('pest_guides')
        .update({ image_url: url })
        .eq('id', guide.id)
      if (error) throw error
      onImage(guide.id, url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mb-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {guide.image_url ? (
        <figure>
          <img
            src={guide.image_url}
            alt={`${guide.pest_name} reference photo`}
            className="w-full rounded-lg object-cover ring-1 ring-outline-variant"
            loading="lazy"
          />
          <figcaption className="mt-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-xs font-medium text-on-surface-variant underline hover:text-on-surface disabled:opacity-60"
            >
              {busy ? 'Replacing…' : 'Replace photo'}
            </button>
          </figcaption>
        </figure>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-outline px-4 py-6 text-sm text-on-surface-variant hover:bg-surface-variant disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          {busy ? 'Uploading…' : 'Add reference photo'}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

export default function PestControlPage() {
  const [guides, setGuides] = useState<PestGuide[]>([])
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

  function setImage(id: string, url: string) {
    setGuides((prev) =>
      prev.map((g) => (g.id === id ? { ...g, image_url: url } : g)),
    )
  }

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
          {guides.map((guide) => {
            const open = expanded === guide.id
            return (
              <li
                key={guide.id}
                className="overflow-hidden rounded-lg bg-surface-container"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`pest-panel-${guide.id}`}
                  onClick={() => setExpanded(open ? null : guide.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="font-semibold text-primary">
                    {guide.pest_name}
                  </span>
                  <ChevronDown
                    className={`size-4 shrink-0 text-on-surface-variant transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {open && (
                  <div
                    id={`pest-panel-${guide.id}`}
                    className="border-t border-outline-variant px-4 py-4"
                  >
                    <PestPhoto guide={guide} onImage={setImage} />

                    {guide.treatment_steps.length > 0 && (
                      <>
                        <h3 className="mb-2 text-sm font-medium text-on-surface-variant">
                          Quick treatment steps
                        </h3>
                        <ol className="mb-5 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-on-surface">
                          {guide.treatment_steps.map((step, i) => (
                            <li key={i} className="pl-1">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}

                    {hasPestProtocol(guide.pest_name) && (
                      <>
                        <h3 className="mb-3 text-sm font-medium text-on-surface-variant">
                          Full treatment protocol
                        </h3>
                        <PestTreatmentGuide pestName={guide.pest_name} />
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
