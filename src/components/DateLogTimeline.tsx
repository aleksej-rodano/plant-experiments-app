import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DateLog } from '../types/database'

interface Props {
  experimentId: string
  /** Render these immediately (no spinner) while the real list loads in the background. */
  initialLogs?: DateLog[]
}

function formatLogDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DateLogTimeline({ experimentId, initialLogs }: Props) {
  const [logs, setLogs] = useState<DateLog[]>(initialLogs ?? [])
  const [loading, setLoading] = useState(initialLogs == null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { data, error } = await supabase
      .from('date_logs')
      .select()
      .eq('experiment_id', experimentId)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else if (data) setLogs(data)
    setLoading(false)
  }, [experimentId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }

  if (error && logs.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 font-medium underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container px-3 py-6 text-center text-sm text-on-surface-variant">
        No log entries yet.
      </p>
    )
  }

  return (
    <ol className="relative ml-1.5 border-l-2 border-outline-variant">
      {logs.map((log) => (
        <li key={log.id} className="relative pb-6 pl-6 last:pb-0">
          <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
          <time className="text-xs font-medium text-on-surface-variant">
            {formatLogDate(log.log_date)}
          </time>
          <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">
            {log.status_details}
          </p>
          {log.image_url && (
            <img
              src={log.image_url}
              alt={`Log from ${formatLogDate(log.log_date)}`}
              className="mt-2 max-h-64 rounded-lg object-cover ring-1 ring-outline-variant"
              loading="lazy"
            />
          )}
        </li>
      ))}
    </ol>
  )
}
