import { Loader2, Pencil, Ruler, Skull, Sprout, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { binRow } from '../lib/utils/bin'
import type { DateLog, Experiment, Folder } from '../types/database'

interface Props {
  experimentId: string
  /** Render these immediately (no spinner) while the real list loads in the background. */
  initialLogs?: DateLog[]
  /** Passed into the edit-log route as navigation state. */
  experiment?: Experiment | null
  folder?: Folder | null
  /** Fires with the current list after every load and after a delete. */
  onLogsChange?: (logs: DateLog[]) => void
}

function formatLogDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DateLogTimeline({
  experimentId,
  initialLogs,
  experiment,
  folder,
  onLogsChange,
}: Props) {
  const [logs, setLogs] = useState<DateLog[]>(initialLogs ?? [])
  const [loading, setLoading] = useState(initialLogs == null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 12000)
    try {
      const { data, error } = await supabase
        .from('date_logs')
        .select()
        .eq('experiment_id', experimentId)
        .is('deleted_at', null)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (error) throw error
      if (data) {
        setLogs(data)
        onLogsChange?.(data)
      }
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond.'
          : e instanceof Error
            ? e.message
            : 'Failed to load the timeline.',
      )
    } finally {
      clearTimeout(abortTimer)
      setLoading(false)
    }
  }, [experimentId, onLogsChange])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(logId: string) {
    setDeletingId(logId)
    try {
      await binRow('date_log', logId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the entry.')
      setDeletingId(null)
      return
    }
    const next = logs.filter((l) => l.id !== logId)
    setLogs(next)
    onLogsChange?.(next)
    setDeletingId(null)
    setConfirmingId(null)
  }

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
          <div className="flex items-start justify-between gap-2">
            <time className="text-xs font-medium text-on-surface-variant">
              {formatLogDate(log.log_date)}
            </time>
            <div className="flex shrink-0 gap-1">
              <Link
                to={`/experiments/${experimentId}/logs/${log.id}/edit`}
                state={{ log, experiment, folder }}
                aria-label={`Edit log from ${formatLogDate(log.log_date)}`}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-variant"
              >
                <Pencil className="size-3.5" />
              </Link>
              <button
                type="button"
                onClick={() =>
                  setConfirmingId(confirmingId === log.id ? null : log.id)
                }
                aria-label={`Delete log from ${formatLogDate(log.log_date)}`}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-variant hover:text-error"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Photo-only entries save an empty note — don't leave a blank line. */}
          {log.status_details?.trim() && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">
              {log.status_details}
            </p>
          )}

          {(log.root_length_mm != null ||
            log.new_leaves != null ||
            log.deaths_count > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-on-surface-variant">
              {log.root_length_mm != null && (
                <span className="flex items-center gap-1">
                  <Ruler className="size-3.5" />
                  {log.root_length_mm} mm roots
                </span>
              )}
              {log.new_leaves != null && (
                <span className="flex items-center gap-1">
                  <Sprout className="size-3.5" />+{log.new_leaves} leaves
                </span>
              )}
              {log.deaths_count > 0 && (
                <span className="flex items-center gap-1 text-error">
                  <Skull className="size-3.5" />
                  {log.deaths_count} died
                  {log.death_cause ? ` · ${log.death_cause}` : ''}
                </span>
              )}
            </div>
          )}

          {log.image_url && (
            <img
              src={log.image_url}
              alt={`Log from ${formatLogDate(log.log_date)}`}
              className="mt-2 max-h-64 rounded-lg object-cover ring-1 ring-outline-variant"
              loading="lazy"
            />
          )}

          {confirmingId === log.id && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2">
              <span className="flex-1 text-xs text-on-surface-variant">
                Move this log entry to the bin?
              </span>
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                disabled={deletingId === log.id}
                className="rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(log.id)}
                disabled={deletingId === log.id}
                className="flex items-center gap-1 rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error disabled:opacity-60"
              >
                {deletingId === log.id && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                Delete
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
