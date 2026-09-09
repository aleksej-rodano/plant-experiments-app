import type { DateLog, Experiment, Folder, Note } from '../../types/database'
import { supabase } from '../supabase'
import { removeUnreferencedImages } from './image'

/** How long a binned item can be restored before it's purged for good. */
export const RETENTION_DAYS = 30

/** Tables that participate in the bin, in parent-to-child order. */
export type BinKind = 'folder' | 'experiment' | 'date_log' | 'note'

type BinTable = 'folders' | 'experiments' | 'date_logs' | 'notes'

const TABLE: Record<BinKind, BinTable> = {
  folder: 'folders',
  experiment: 'experiments',
  date_log: 'date_logs',
  note: 'notes',
}

export interface BinEntry {
  kind: BinKind
  id: string
  batchId: string | null
  label: string
  /** e.g. "3 experiments · 12 log entries" — what else goes back on restore. */
  contains: string | null
  deletedAt: string
  /** Whole days left before the permanent purge; can be 0. */
  daysLeft: number
}

function stampFields(batchId: string, at: string, root: boolean) {
  return { deleted_at: at, delete_batch_id: batchId, deleted_root: root }
}

function daysLeft(deletedAt: string): number {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed))
}

/** Reset the soft-delete bookkeeping — the inverse of `stampFields`. */
const CLEAR = { deleted_at: null, delete_batch_id: null, deleted_root: false }

/**
 * Undo a partly-applied bin. These sequences are several statements against
 * different tables with no transaction around them, so a failure halfway
 * through would otherwise leave children binned under a parent that is still
 * live — and, before `listBin` learned to group by batch, invisible.
 *
 * Best effort: if the rollback itself fails the rows are still recoverable,
 * because the whole batch shares one id and `listBin` surfaces it.
 */
async function rollbackBatch(batch: string): Promise<void> {
  await Promise.all(
    (['date_logs', 'experiments', 'folders'] as const).map((table) =>
      supabase.from(table).update(CLEAR).eq('delete_batch_id', batch),
    ),
  ).catch(() => undefined)
}

/**
 * Move a folder and everything under it to the bin. Children are stamped first,
 * while they're still findable as live rows, and share the folder's batch id so
 * a restore brings back exactly this set — not items binned separately earlier.
 */
export async function binFolder(folderId: string): Promise<void> {
  const batch = crypto.randomUUID()
  const at = new Date().toISOString()

  const { data: exps, error: expErr } = await supabase
    .from('experiments')
    .select('id')
    .eq('folder_id', folderId)
    .is('deleted_at', null)
  if (expErr) throw expErr

  const expIds = (exps ?? []).map((e) => e.id)
  try {
    if (expIds.length > 0) {
      const { error } = await supabase
        .from('date_logs')
        .update(stampFields(batch, at, false))
        .in('experiment_id', expIds)
        .is('deleted_at', null)
      if (error) throw error

      const { error: e2 } = await supabase
        .from('experiments')
        .update(stampFields(batch, at, false))
        .in('id', expIds)
      if (e2) throw e2
    }

    const { error } = await supabase
      .from('folders')
      .update(stampFields(batch, at, true))
      .eq('id', folderId)
    if (error) throw error
  } catch (e) {
    await rollbackBatch(batch)
    throw e
  }
}

/** Move an experiment and its log entries to the bin. */
export async function binExperiment(experimentId: string): Promise<void> {
  const batch = crypto.randomUUID()
  const at = new Date().toISOString()

  try {
    const { error: logErr } = await supabase
      .from('date_logs')
      .update(stampFields(batch, at, false))
      .eq('experiment_id', experimentId)
      .is('deleted_at', null)
    if (logErr) throw logErr

    const { error } = await supabase
      .from('experiments')
      .update(stampFields(batch, at, true))
      .eq('id', experimentId)
    if (error) throw error
  } catch (e) {
    await rollbackBatch(batch)
    throw e
  }
}

/** Move a single row with no children (a log entry or a note) to the bin. */
export async function binRow(
  kind: 'date_log' | 'note',
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE[kind])
    .update(stampFields(crypto.randomUUID(), new Date().toISOString(), true))
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
}

/**
 * Put a whole batch back. A folder restore also revives its experiments and
 * logs, because they carry the same batch id.
 */
export async function restoreBatch(batchId: string): Promise<void> {
  for (const table of ['folders', 'experiments', 'date_logs', 'notes'] as const) {
    const { error } = await supabase
      .from(table)
      .update(CLEAR)
      .eq('delete_batch_id', batchId)
    if (error) throw error
  }
  await reviveAncestors(batchId)
}

/**
 * Bring back any still-binned parent of what we just restored. Without this,
 * restoring an experiment that was binned *before* its folder was would put the
 * row back inside an invisible folder — restored, but nowhere to be seen.
 *
 * A revived parent loses its own batch stamp, which strands whatever else went
 * down with it: those rows keep `deleted_at` but no longer have a `deleted_root`
 * row to represent them. `listBin` groups by batch precisely so that set still
 * shows up (under its shallowest surviving row) and stays restorable.
 */
async function reviveAncestors(batchId: string): Promise<void> {
  const { data: logs } = await supabase
    .from('date_logs')
    .select('experiment_id')
    .eq('delete_batch_id', batchId)

  const logExpIds = [...new Set((logs ?? []).map((l) => l.experiment_id))]
  if (logExpIds.length > 0) {
    await supabase
      .from('experiments')
      .update(CLEAR)
      .in('id', logExpIds)
      .not('deleted_at', 'is', null)
  }

  // Every experiment now live because of this restore — the ones in the batch
  // itself, plus any parent revived just above.
  const [inBatch, parents] = await Promise.all([
    supabase
      .from('experiments')
      .select('folder_id')
      .eq('delete_batch_id', batchId),
    logExpIds.length > 0
      ? supabase.from('experiments').select('folder_id').in('id', logExpIds)
      : Promise.resolve({ data: [] as { folder_id: string }[] }),
  ])

  const folderIds = [
    ...new Set(
      [...(inBatch.data ?? []), ...(parents.data ?? [])].map(
        (e) => e.folder_id,
      ),
    ),
  ]
  if (folderIds.length > 0) {
    await supabase
      .from('folders')
      .update(CLEAR)
      .in('id', folderIds)
      .not('deleted_at', 'is', null)
  }
}

/** The shape every binnable row shares, plus a display label. */
interface BinnedRow {
  kind: BinKind
  id: string
  deletedAt: string
  batchId: string | null
  isRoot: boolean
  label: string
}

function normalise<T extends { id: string; deleted_at: string | null; delete_batch_id: string | null; deleted_root: boolean }>(
  kind: BinKind,
  rows: T[],
  label: (row: T) => string,
): BinnedRow[] {
  return rows
    .filter((r) => r.deleted_at != null)
    .map((r) => ({
      kind,
      id: r.id,
      deletedAt: r.deleted_at!,
      batchId: r.delete_batch_id,
      isRoot: r.deleted_root,
      label: label(r),
    }))
}

const KIND_NOUN: Record<BinKind, [string, string]> = {
  folder: ['folder', 'folders'],
  experiment: ['experiment', 'experiments'],
  date_log: ['log entry', 'log entries'],
  note: ['note', 'notes'],
}

const plural = (n: number, kind: BinKind) =>
  `${n} ${KIND_NOUN[kind][n === 1 ? 0 : 1]}`

/**
 * Read the bin: one entry per delete action, newest first.
 *
 * Entries are derived per *batch* rather than by trusting `deleted_root`. The
 * row the user clicked delete on normally carries that flag, but it can be
 * revived on its own — restoring a log revives its experiment, restoring an
 * experiment revives its folder — and a partly-applied bin never sets it at
 * all. Grouping by batch and naming it after the shallowest row still binned
 * means such a set is represented by whatever survives, instead of dropping out
 * of the bin and being purged 30 days later without ever having been listed.
 */
export async function listBin(): Promise<BinEntry[]> {
  const [folders, experiments, logs, notes] = await Promise.all([
    supabase.from('folders').select().not('deleted_at', 'is', null),
    supabase.from('experiments').select().not('deleted_at', 'is', null),
    supabase.from('date_logs').select().not('deleted_at', 'is', null),
    supabase.from('notes').select().not('deleted_at', 'is', null),
  ])

  const failed = [folders, experiments, logs, notes].find((r) => r.error)
  if (failed?.error) throw failed.error

  return binEntries({
    folders: (folders.data ?? []) as Folder[],
    experiments: (experiments.data ?? []) as Experiment[],
    date_logs: (logs.data ?? []) as DateLog[],
    notes: (notes.data ?? []) as Note[],
  })
}

/** The binned rows, by table. */
export interface BinnedRows {
  folders: Folder[]
  experiments: Experiment[]
  date_logs: DateLog[]
  notes: Note[]
}

/** The pure half of `listBin` — see its doc comment for why it groups by batch. */
export function binEntries(rows: BinnedRows): BinEntry[] {
  // Parent-to-child order: the shallowest tier holding a row names its batch.
  const tiers: BinnedRow[][] = [
    normalise('folder', rows.folders, (f) => f.title),
    normalise('experiment', rows.experiments, (e) => e.title),
    normalise(
      'date_log',
      rows.date_logs,
      (l) => l.status_details?.trim() || `Log from ${l.log_date}`,
    ),
    normalise('note', rows.notes, (n) => n.body.slice(0, 80) || 'Note'),
  ]
  const all = tiers.flat()

  const entries: BinEntry[] = []
  const claimed = new Set<string>()

  for (const tier of tiers) {
    for (const row of tier) {
      // Rows binned before batch ids existed can't be grouped or restored as a
      // set; list them individually so they're at least visible.
      if (!row.batchId) {
        entries.push({
          kind: row.kind,
          id: row.id,
          batchId: null,
          label: row.label,
          contains: null,
          deletedAt: row.deletedAt,
          daysLeft: daysLeft(row.deletedAt),
        })
        continue
      }
      if (claimed.has(row.batchId)) continue
      claimed.add(row.batchId)

      const batch = row.batchId
      // Within a tier the flagged row is the one the user actually clicked;
      // fall back to any row at this depth when the flagged one is gone.
      const rep = tier.find((r) => r.batchId === batch && r.isRoot) ?? row

      // Everything else coming back with it, counted per kind.
      const counts = new Map<BinKind, number>()
      for (const other of all) {
        if (other.batchId !== batch || other === rep) continue
        counts.set(other.kind, (counts.get(other.kind) ?? 0) + 1)
      }
      const parts = [...counts.entries()]
        .filter(([, n]) => n > 0)
        .map(([kind, n]) => plural(n, kind))

      entries.push({
        kind: rep.kind,
        id: rep.id,
        batchId: batch,
        label: rep.label,
        contains: parts.length > 0 ? parts.join(' · ') : null,
        deletedAt: rep.deletedAt,
        daysLeft: daysLeft(rep.deletedAt),
      })
    }
  }

  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

/** Hard-delete one batch now, photos included. */
export async function purgeBatch(batchId: string): Promise<void> {
  await purgeWhere((table) =>
    supabase
      .from(table)
      .select()
      .eq('delete_batch_id', batchId)
      // Never reachable through the bin UI, but a batch id can outlive a row
      // that was revived as somebody's ancestor. Purging by id alone would then
      // hard-delete a live folder and cascade to everything inside it.
      .not('deleted_at', 'is', null),
  )
}

/**
 * Hard-delete everything binned longer than `RETENTION_DAYS` ago, and remove the
 * photos it referenced from storage. Called once when the app starts; returns
 * how many rows went.
 */
export async function purgeExpired(): Promise<number> {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 86_400_000,
  ).toISOString()
  return purgeWhere((table) =>
    supabase.from(table).select().lt('deleted_at', cutoff),
  )
}

type Selector = (
  table: BinTable,
) => PromiseLike<{ data: unknown[] | null; error: unknown }>

/**
 * Shared purge body. Deletes parents first so the existing FK cascades take the
 * children with them; the remaining per-table deletes then clean up anything
 * binned on its own.
 */
async function purgeWhere(select: Selector): Promise<number> {
  const [folders, experiments, logs, notes] = await Promise.all([
    select('folders'),
    select('experiments'),
    select('date_logs'),
    select('notes'),
  ])

  const failedSelect = [folders, experiments, logs, notes].find((r) => r.error)
  if (failedSelect?.error) throw failedSelect.error

  const rows = {
    folders: (folders.data ?? []) as Folder[],
    experiments: (experiments.data ?? []) as Experiment[],
    date_logs: (logs.data ?? []) as DateLog[],
    notes: (notes.data ?? []) as Note[],
  }

  const total =
    rows.folders.length +
    rows.experiments.length +
    rows.date_logs.length +
    rows.notes.length
  if (total === 0) return 0

  // Collect photo URLs before the rows disappear.
  const urls = [
    ...rows.folders.map((f) => f.cover_image_url),
    ...rows.experiments.map((e) => e.cover_image_url),
    ...rows.date_logs.map((l) => l.image_url),
    ...rows.notes.map((n) => n.image_url),
  ].filter((u): u is string => !!u)

  const byId = async (table: BinTable, ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase.from(table).delete().in('id', ids)
    // Deleting the photos of rows that are still there would leave the user
    // with permanently broken images, so a failed delete has to stop the purge
    // rather than fall through to the storage cleanup.
    if (error) throw error
  }

  // Parents first: deleting a folder cascades to its experiments and logs.
  await byId('folders', rows.folders.map((f) => f.id))
  await byId('experiments', rows.experiments.map((e) => e.id))
  await byId('date_logs', rows.date_logs.map((l) => l.id))
  await byId('notes', rows.notes.map((n) => n.id))

  // Best effort, and only files nothing points at any more: one upload can be
  // shared across every experiment in a folder (see FolderDateLogForm), so a
  // blind delete here would break the photo in the entries that survived.
  await removeUnreferencedImages(urls)

  return total
}
