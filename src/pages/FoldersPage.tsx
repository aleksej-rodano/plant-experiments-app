import { CheckCircle2, FolderPlus, Layers, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import FolderCard from '../components/FolderCard'
import { supabase } from '../lib/supabase'
import { survivorCount } from '../lib/utils/survival'
import type { Folder } from '../types/database'

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [plantTotals, setPlantTotals] = useState<Record<string, number>>({})
  const [aliveTotals, setAliveTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (!state?.toast) return
    setToast(state.toast)
    navigate('.', { replace: true, state: null })
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [location.state, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setSlow(false)
    setError(null)

    const controller = new AbortController()
    const slowTimer = setTimeout(() => setSlow(true), 4000)
    const abortTimer = setTimeout(() => controller.abort(), 15000)

    try {
      const [foldersRes, expRes, deathRes] = await Promise.all([
        supabase
          .from('folders')
          .select()
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal),
        supabase
          .from('experiments')
          .select('id, folder_id, plant_count')
          .abortSignal(controller.signal),
        supabase
          .from('date_logs')
          .select('experiment_id, deaths_count')
          .abortSignal(controller.signal),
      ])
      if (foldersRes.error) throw foldersRes.error
      if (expRes.error) throw expRes.error
      if (deathRes.error) throw deathRes.error

      const deathsByExp: Record<string, number> = {}
      for (const row of deathRes.data ?? []) {
        deathsByExp[row.experiment_id] =
          (deathsByExp[row.experiment_id] ?? 0) + (row.deaths_count ?? 0)
      }

      const tally: Record<string, number> = {}
      const plants: Record<string, number> = {}
      const alive: Record<string, number> = {}
      for (const row of expRes.data ?? []) {
        tally[row.folder_id] = (tally[row.folder_id] ?? 0) + 1
        plants[row.folder_id] =
          (plants[row.folder_id] ?? 0) + (row.plant_count ?? 0)
        alive[row.folder_id] =
          (alive[row.folder_id] ?? 0) +
          survivorCount(row.plant_count, deathsByExp[row.id] ?? 0)
      }
      setFolders(foldersRes.data ?? [])
      setCounts(tally)
      setPlantTotals(plants)
      setAliveTotals(alive)
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'The server took too long to respond. Check your connection and retry.'
          : e instanceof Error
            ? e.message
            : 'Failed to load folders.',
      )
    } finally {
      clearTimeout(slowTimer)
      clearTimeout(abortTimer)
      setSlow(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(id: string) {
    const { error } = await supabase.from('folders').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-medium text-on-surface">
          <Layers className="size-6 text-primary" />
          Experiment Folders
        </h1>
        <Link
          to="/folders/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:opacity-90"
        >
          <FolderPlus className="size-4" />
          <span className="hidden sm:inline">New Folder</span>
        </Link>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

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
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          {slow && (
            <p className="text-sm text-on-surface-variant">
              Still loading — your connection to the server seems slow.
            </p>
          )}
        </div>
      ) : folders.length === 0 && !error ? (
        <div className="rounded-lg bg-surface-container px-4 py-16 text-center">
          <Layers className="mx-auto mb-3 size-10 text-on-surface-variant/50" />
          <p className="text-on-surface">No folders yet.</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            A folder holds one batch of plants and the experiments you run on it.
          </p>
          <Link
            to="/folders/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
          >
            <FolderPlus className="size-4" />
            New Folder
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              experimentCount={counts[folder.id] ?? 0}
              plantTotal={plantTotals[folder.id] ?? 0}
              aliveTotal={aliveTotals[folder.id] ?? 0}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}
