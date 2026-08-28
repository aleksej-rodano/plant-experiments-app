import { supabase } from '../supabase'

export interface BackupFile {
  app: 'plant-experiments'
  version: 1
  exported_at: string
  data: {
    folders: unknown[]
    experiments: unknown[]
    date_logs: unknown[]
    feeding_logs: unknown[]
    notes: unknown[]
  }
}

/**
 * Pull every row the signed-in user owns. Row-level security already scopes each
 * table to the current user (date_logs via its parent experiment), so a plain
 * select returns only their data.
 */
export async function buildBackup(): Promise<BackupFile> {
  const [folders, experiments, dateLogs, feedingLogs, notes] = await Promise.all(
    [
      supabase.from('folders').select().order('created_at'),
      supabase.from('experiments').select().order('created_at'),
      supabase.from('date_logs').select().order('created_at'),
      supabase.from('feeding_logs').select().order('created_at'),
      supabase.from('notes').select().order('created_at'),
    ],
  )

  const first = [folders, experiments, dateLogs, feedingLogs, notes].find(
    (r) => r.error,
  )
  if (first?.error) throw first.error

  return {
    app: 'plant-experiments',
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      folders: folders.data ?? [],
      experiments: experiments.data ?? [],
      date_logs: dateLogs.data ?? [],
      feeding_logs: feedingLogs.data ?? [],
      notes: notes.data ?? [],
    },
  }
}

/** Trigger a client-side download of `obj` as pretty-printed JSON. */
export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
