import { CheckCircle2, ChevronRight, Download, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildBackup, downloadJson } from '../lib/utils/backup'
import { RETENTION_DAYS } from '../lib/utils/bin'

export default function SettingsPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneAt, setDoneAt] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    setDoneAt(null)
    try {
      const backup = await buildBackup()
      const stamp = new Date().toISOString().slice(0, 10)
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

      <p className="mt-6 text-center text-xs text-on-surface-variant/70">
        Build {__BUILD_TIME__}
      </p>
    </section>
  )
}
