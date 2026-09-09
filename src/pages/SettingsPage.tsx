import {
  CheckCircle2,
  ChevronRight,
  Download,
  ImageOff,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks/useAuth'
import { buildBackup, downloadJson } from '../lib/utils/backup'
import { RETENTION_DAYS } from '../lib/utils/bin'
import { today } from '../lib/utils/date'
import {
  deleteStoredPaths,
  findOrphanedImages,
  formatBytes,
  type OrphanedImage,
} from '../lib/utils/image'

export default function SettingsPage() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneAt, setDoneAt] = useState<string | null>(null)

  // Unused-photo cleanup. `orphans` is null before a scan, [] after one that
  // found nothing — the two read very differently to the user.
  const [scanning, setScanning] = useState(false)
  const [orphans, setOrphans] = useState<OrphanedImage[] | null>(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [cleanupDone, setCleanupDone] = useState<string | null>(null)

  async function handleScan() {
    if (!user) return
    setScanning(true)
    setCleanupError(null)
    setCleanupDone(null)
    try {
      setOrphans(await findOrphanedImages(user.id))
    } catch (e) {
      setCleanupError(
        e instanceof Error ? e.message : 'Could not check for unused photos.',
      )
    } finally {
      setScanning(false)
    }
  }

  async function handleClean() {
    if (!orphans?.length) return
    setCleaning(true)
    setCleanupError(null)
    try {
      const removed = await deleteStoredPaths(orphans.map((o) => o.path))
      const freed = orphans.reduce((sum, o) => sum + o.bytes, 0)
      setCleanupDone(
        `Removed ${removed} file${removed === 1 ? '' : 's'}, freeing ${formatBytes(freed)}.`,
      )
      setOrphans([])
    } catch (e) {
      setCleanupError(
        e instanceof Error ? e.message : 'Could not delete the unused photos.',
      )
    } finally {
      setCleaning(false)
    }
  }

  async function handleExport() {
    setBusy(true)
    setError(null)
    setDoneAt(null)
    try {
      const backup = await buildBackup()
      const stamp = today()
      downloadJson(backup, `plant-experiments-backup-${stamp}.json`)
      const d = backup.data
      setDoneAt(
        `${d.folders.length} folders · ${d.experiments.length} experiments · ` +
          `${d.date_logs.length} log entries · ${d.feeding_logs.length} feeding logs · ` +
          `${d.notes.length} notes`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <h1 className="text-xl font-medium text-on-surface">Settings</h1>

      <Link
        to="/bin"
        className="mt-4 flex items-center gap-3 rounded-lg bg-surface-container p-4 hover:opacity-90"
      >
        <Trash2 className="size-5 shrink-0 text-on-surface-variant" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-on-surface">Bin</span>
          <span className="block text-sm text-on-surface-variant">
            Restore deleted folders, experiments, log entries and notes for up to{' '}
            {RETENTION_DAYS} days.
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-on-surface-variant" />
      </Link>

      <div className="mt-4 rounded-lg bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">Back up your data</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Download a full copy of everything you've added — folders, experiments,
          log entries, feeding logs, and notes — as a single JSON file. This runs
          entirely on your device; nothing is uploaded anywhere. Photos are kept
          as links, not copied into the file.
        </p>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy}
          className="mt-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {busy ? 'Preparing…' : 'Download backup'}
        </button>

        {doneAt && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>Backup downloaded — {doneAt}.</span>
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-surface-container p-4">
        <h2 className="font-medium text-on-surface">Unused photos</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Photos that no folder, experiment, log entry or note points at any
          more — uploads that were interrupted before saving, and anything left
          behind before the storage bucket allowed deletes. Items still in the
          bin count as in use, so nothing you can still restore is touched, and
          anything uploaded in the last 24 hours is left alone in case it
          belongs to a form you have open.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={scanning || cleaning}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageOff className="size-4" />
            )}
            {scanning ? 'Checking…' : 'Check for unused photos'}
          </button>

          {orphans && orphans.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClean()}
              disabled={cleaning}
              className="flex items-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-medium text-on-error disabled:opacity-60"
            >
              {cleaning && <Loader2 className="size-4 animate-spin" />}
              Delete {orphans.length} file{orphans.length === 1 ? '' : 's'} (
              {formatBytes(orphans.reduce((sum, o) => sum + o.bytes, 0))})
            </button>
          )}
        </div>

        {orphans?.length === 0 && !cleanupDone && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>Nothing unused — every photo is still in use.</span>
          </p>
        )}
        {cleanupDone && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{cleanupDone}</span>
          </p>
        )}
        {cleanupError && (
          <p className="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {cleanupError}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-on-surface-variant/70">
        Build {__BUILD_TIME__}
      </p>
    </section>
  )
}
