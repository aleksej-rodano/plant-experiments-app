import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import FolderDateLogForm from '../components/FolderDateLogForm'
import { supabase } from '../lib/supabase'
import type { Experiment, Folder } from '../types/database'

export default function AddFolderDateLogPage() {
  const { folderId } = useParams<{ folderId: string }>()
  const location = useLocation()
  const navState = location.state as {
    folder?: Folder
    experiments?: Experiment[]
  } | null

  const [folder, setFolder] = useState<Folder | null>(navState?.folder ?? null)
  const [experiments, setExperiments] = useState<Experiment[] | null>(
    navState?.experiments ?? null,
  )
  const [error, setError] = useState<string | null>(null)

  const backTo = folderId ? `/folders/${folderId}` : '/experiments'

  useEffect(() => {
    if (!folderId || experiments != null) return
    let cancelled = false
    void (async () => {
      const [folderRes, expRes] = await Promise.all([
        folder
          ? Promise.resolve({ data: folder, error: null })
          : supabase
              .from('folders')
              .select()
              .eq('id', folderId)
              .is('deleted_at', null)
              .maybeSingle(),
        supabase
          .from('experiments')
          .select()
          .eq('folder_id', folderId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (folderRes.error) setError(folderRes.error.message)
      else if (folderRes.data) setFolder(folderRes.data)
      if (expRes.error) setError(expRes.error.message)
      setExperiments(expRes.data ?? [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId])

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={backTo}
          className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant"
          aria-label="Back to folder"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-medium text-on-surface">
          Log for all experiments
        </h1>
      </div>

      {folder && (
        <p className="mb-4 text-sm text-on-surface-variant">{folder.title}</p>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {!folderId ? (
        <p className="text-sm text-error">Missing folder id.</p>
      ) : experiments == null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <FolderDateLogForm
          experiments={experiments}
          folderId={folderId}
          backTo={backTo}
          doneState={{ folder }}
        />
      )}
    </section>
  )
}
