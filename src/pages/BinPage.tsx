import {
  ArrowLeft,
  FileText,
  FlaskConical,
  FolderOpen,
  Loader2,
  NotebookPen,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RETENTION_DAYS,
  listBin,
  purgeBatch,
  restoreBatch,
  type BinEntry,
  type BinKind,
} from '../lib/utils/bin'

const KIND_ICON: Record<BinKind, typeof FolderOpen> = {
  folder: FolderOpen,
  experiment: FlaskConical,
  date_log: FileText,
  note: NotebookPen,
}

const KIND_LABEL: Record<BinKind, string> = {
  folder: 'Folder',
  experiment: 'Experiment',
  date_log: 'Log entry',
  note: 'Note',
}

function formatDeleted(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function BinPage() {
  const [entries, setEntries] = useState<BinEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEntries(await listBin())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the bin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(entry: BinEntry, action: 'restore' | 'purge') {
    if (!entry.batchId) {
      setError('This item is missing its delete reference and can’t be acted on.')
      return
    }
    setBusyId(entry.id)
    setError(null)
    try {
      if (action === 'restore') await restoreBatch(entry.batchId)
      else await purgeBatch(entry.batchId)
      await load()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Could not ${action === 'restore' ? 'restore' : 'delete'} that.`,
      )
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="size-4" />
        Settings
      </Link>

      <h1 className="mt-3 text-2xl font-medium text-on-surface">Bin</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Deleted items stay here for {RETENTION_DAYS} days, then are removed
        permanently along with their photos.
      </p>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
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
      ) : entries.length === 0 ? (
        <div className="mt-4 rounded-lg bg-surface-container px-4 py-12 text-center">
          <Trash2 className="mx-auto mb-3 size-8 text-on-surface-variant/50" />
          <p className="text-on-surface">The bin is empty.</p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {entries.map((entry) => {
            const Icon = KIND_ICON[entry.kind]
            return (
              <li
                key={`${entry.kind}-${entry.id}`}
                className="rounded-lg bg-surface-container px-3 py-2"
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-on-surface-variant" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-on-surface">
                      {entry.label}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {KIND_LABEL[entry.kind]}
                      {entry.contains ? ` · ${entry.contains}` : ''} · deleted{' '}
                      {formatDeleted(entry.deletedAt)} ·{' '}
                      <span
                        className={entry.daysLeft <= 3 ? 'text-error' : undefined}
                      >
                        {entry.daysLeft} day{entry.daysLeft === 1 ? '' : 's'} left
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void act(entry, 'restore')}
                      disabled={busyId === entry.id}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant disabled:opacity-60"
                    >
                      {busyId === entry.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmingId(
                          confirmingId === entry.id ? null : entry.id,
                        )
                      }
                      disabled={busyId === entry.id}
                      aria-label={`Permanently delete ${entry.label}`}
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant hover:text-error"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {confirmingId === entry.id && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="flex-1 text-xs text-on-surface-variant">
                      Delete permanently? This cannot be undone.
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-variant"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(entry, 'purge')}
                      disabled={busyId === entry.id}
                      className="flex items-center gap-1 rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error disabled:opacity-60"
                    >
                      {busyId === entry.id && (
                        <Loader2 className="size-3 animate-spin" />
                      )}
                      Delete forever
                    </button>
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
