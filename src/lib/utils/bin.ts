import type {
  DateLog,
  Experiment,
  Folder,
  Note,
  Pot,
  Potting,
} from '../../types/database'
import { syncCareNotifications } from '../native'
import { supabase } from '../supabase'
import { removeStoredImages } from './image'

/** How long a binned item can be restored before it's purged for good. */
export const RETENTION_DAYS = 30

/** Tables that participate in the bin. */
export type BinKind =
  | 'folder'
  | 'experiment'
  | 'potting'
  | 'pot'
  | 'date_log'
  | 'note'

type BinTable =
  | 'folders'
  | 'experiments'
  | 'pottings'
  | 'pots'
  | 'date_logs'
  | 'notes'

const TABLE: Record<BinKind, BinTable> = {
  folder: 'folders',
  experiment: 'experiments',
  potting: 'pottings',
  pot: 'pots',
  date_log: 'date_logs',
  note: 'notes',
}

/** Parent-to-child order; restore and purge walk this list. */
const ALL_TABLES: BinTable[] = [
  'folders',
  'experiments',
  'pottings',
  'pots',
  'date_logs',
  'notes',
]

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

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
  if (expIds.length > 0) {
    // Logs (pot logs carry experiment_id too), pots and pottings all go down
    // under the folder's batch id.
    for (const table of ['date_logs', 'pots', 'pottings'] as const) {
      const { error } = await supabase
        .from(table)
        .update(stampFields(batch, at, false))
        .in('experiment_id', expIds)
        .is('deleted_at', null)
      if (error) throw error
    }

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
  // A binned folder's reminder must stop firing.
  void syncCareNotifications()
}

/** Move an experiment, its log entries, pottings and pots to the bin. */
export async function binExperiment(experimentId: string): Promise<void> {
  const batch = crypto.randomUUID()
  const at = new Date().toISOString()

  for (const table of ['date_logs', 'pots', 'pottings'] as const) {
    const { error } = await supabase
      .from(table)
      .update(stampFields(batch, at, false))
      .eq('experiment_id', experimentId)
      .is('deleted_at', null)
    if (error) throw error
  }

  const { error } = await supabase
    .from('experiments')
    .update(stampFields(batch, at, true))
    .eq('id', experimentId)
  if (error) throw error
}

/**
 * Move a potting event to the bin. Its pots and the check-ins logged against
 * them share its batch id, so restoring the potting brings the lot back.
 */
export async function binPotting(pottingId: string): Promise<void> {
  const batch = crypto.randomUUID()
  const at = new Date().toISOString()

  const { data: pots, error: potErr } = await supabase
    .from('pots')
    .select('id')
    .eq('potting_id', pottingId)
    .is('deleted_at', null)
  if (potErr) throw potErr

  const potIds = (pots ?? []).map((p) => p.id)
  if (potIds.length > 0) {
    const { error: logErr } = await supabase
      .from('date_logs')
      .update(stampFields(batch, at, false))
      .in('pot_id', potIds)
      .is('deleted_at', null)
    if (logErr) throw logErr

    const { error } = await supabase
      .from('pots')
      .update(stampFields(batch, at, false))
      .in('id', potIds)
    if (error) throw error
  }

  const { error } = await supabase
    .from('pottings')
    .update(stampFields(batch, at, true))
    .eq('id', pottingId)
  if (error) throw error
}

/** Move one pot and its check-ins to the bin. */
export async function binPot(potId: string): Promise<void> {
  const batch = crypto.randomUUID()
  const at = new Date().toISOString()

  const { error: logErr } = await supabase
    .from('date_logs')
    .update(stampFields(batch, at, false))
    .eq('pot_id', potId)
    .is('deleted_at', null)
  if (logErr) throw logErr

  const { error } = await supabase
    .from('pots')
    .update(stampFields(batch, at, true))
    .eq('id', potId)
  if (error) throw error
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
  if (error) throw error
}

const CLEAR = { deleted_at: null, delete_batch_id: null, deleted_root: false }

/**
 * Put a whole batch back. A folder restore also revives its experiments, pottings,
 * pots and logs, because they carry the same batch id.
 */
export async function restoreBatch(batchId: string): Promise<void> {
  for (const table of ALL_TABLES) {
    const { error } = await supabase
      .from(table)
      .update(CLEAR)
      .eq('delete_batch_id', batchId)
    if (error) throw error
  }
  await reviveAncestors(batchId)
  void syncCareNotifications()
}

/**
 * Bring back any still-binned parent of what we just restored. Without this,
 * restoring an experiment that was binned *before* its folder was would put the
 * row back inside an invisible folder — restored, but nowhere to be seen. The
 * same goes down the chain: pot logs need their pot, pots their potting,
 * pottings their experiment.
 */
async function reviveAncestors(batchId: string): Promise<void> {
  const [logs, pots, pottings] = await Promise.all([
    supabase
      .from('date_logs')
      .select('experiment_id, pot_id')
      .eq('delete_batch_id', batchId),
    supabase
      .from('pots')
      .select('potting_id, experiment_id')
      .eq('delete_batch_id', batchId),
    supabase
      .from('pottings')
      .select('experiment_id')
      .eq('delete_batch_id', batchId),
  ])

  // Pot logs -> their pots.
  const logPotIds = [
    ...new Set(
      (logs.data ?? []).map((l) => l.pot_id).filter((id): id is string => !!id),
    ),
  ]
  let revivedPots: { potting_id: string; experiment_id: string }[] = []
  if (logPotIds.length > 0) {
    await supabase
      .from('pots')
      .update(CLEAR)
      .in('id', logPotIds)
      .not('deleted_at', 'is', null)
    const { data } = await supabase
      .from('pots')
      .select('potting_id, experiment_id')
      .in('id', logPotIds)
    revivedPots = data ?? []
  }

  // Pots -> their pottings.
  const allPots = [...(pots.data ?? []), ...revivedPots]
  const pottingIds = [...new Set(allPots.map((p) => p.potting_id))]
  let revivedPottings: { experiment_id: string }[] = []
  if (pottingIds.length > 0) {
    await supabase
      .from('pottings')
      .update(CLEAR)
      .in('id', pottingIds)
      .not('deleted_at', 'is', null)
    const { data } = await supabase
      .from('pottings')
      .select('experiment_id')
      .in('id', pottingIds)
    revivedPottings = data ?? []
  }

  // Logs, pots and pottings -> their experiment.
  const logExpIds = [
    ...new Set(
      [
        ...(logs.data ?? []),
        ...allPots,
        ...(pottings.data ?? []),
        ...revivedPottings,
      ].map((r) => r.experiment_id),
    ),
  ]
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

/** Read the bin: one entry per delete action, newest first. */
export async function listBin(): Promise<BinEntry[]> {
  const [folders, experiments, pottings, pots, logs, notes] = await Promise.all([
    supabase.from('folders').select().not('deleted_at', 'is', null),
    supabase.from('experiments').select().not('deleted_at', 'is', null),
    supabase.from('pottings').select().not('deleted_at', 'is', null),
    supabase.from('pots').select().not('deleted_at', 'is', null),
    supabase.from('date_logs').select().not('deleted_at', 'is', null),
    supabase.from('notes').select().not('deleted_at', 'is', null),
  ])

  const failed = [folders, experiments, pottings, pots, logs, notes].find(
    (r) => r.error,
  )
  if (failed?.error) throw failed.error

  const allExps = (experiments.data ?? []) as Experiment[]
  const allPottings = (pottings.data ?? []) as Potting[]
  const allPots = (pots.data ?? []) as Pot[]
  const allLogs = (logs.data ?? []) as DateLog[]
  const entries: BinEntry[] = []

  const add = (
    kind: BinKind,
    row: { id: string; deleted_at: string | null; delete_batch_id: string | null },
    label: string,
    contains: string | null,
  ) => {
    if (!row.deleted_at) return
    entries.push({
      kind,
      id: row.id,
      batchId: row.delete_batch_id,
      label,
      contains,
      deletedAt: row.deleted_at,
      daysLeft: daysLeft(row.deleted_at),
    })
  }

  const inBatch = <T extends { delete_batch_id: string | null }>(
    rows: T[],
    batchId: string | null,
  ) => rows.filter((r) => r.delete_batch_id === batchId)

  for (const f of (folders.data ?? []) as Folder[]) {
    if (!f.deleted_root) continue
    const expCount = inBatch(allExps, f.delete_batch_id).length
    const potCount = inBatch(allPots, f.delete_batch_id).length
    const logCount = inBatch(allLogs, f.delete_batch_id).length
    const parts = [
      expCount > 0 && plural(expCount, 'experiment'),
      potCount > 0 && plural(potCount, 'pot'),
      logCount > 0 && plural(logCount, 'log entry', 'log entries'),
    ].filter(Boolean) as string[]
    add('folder', f, f.title, parts.length > 0 ? parts.join(' · ') : null)
  }

  for (const e of allExps) {
    if (!e.deleted_root) continue
    const potCount = inBatch(allPots, e.delete_batch_id).length
    const logCount = inBatch(allLogs, e.delete_batch_id).length
    const parts = [
      potCount > 0 && plural(potCount, 'pot'),
      logCount > 0 && plural(logCount, 'log entry', 'log entries'),
    ].filter(Boolean) as string[]
    add('experiment', e, e.title, parts.length > 0 ? parts.join(' · ') : null)
  }

  for (const t of allPottings) {
    if (!t.deleted_root) continue
    // Its pots share the batch id; the plant total is what moved in this event.
    const pottingPots = inBatch(allPots, t.delete_batch_id).filter(
      (p) => p.potting_id === t.id,
    )
    const plants = pottingPots.reduce((sum, p) => sum + p.plant_count, 0)
    const logCount = inBatch(allLogs, t.delete_batch_id).length
    add(
      'potting',
      t,
      `Potting of ${plural(plants, 'plant')} · ${plural(pottingPots.length, 'pot')}`,
      logCount > 0 ? plural(logCount, 'pot check-in') : null,
    )
  }

  for (const p of allPots) {
    if (!p.deleted_root) continue
    const logCount = inBatch(allLogs, p.delete_batch_id).length
    add(
      'pot',
      p,
      `Pot: ${p.label}`,
      logCount > 0 ? plural(logCount, 'pot check-in') : null,
    )
  }

  for (const l of allLogs) {
    if (!l.deleted_root) continue
    add('date_log', l, l.status_details?.trim() || `Log from ${l.log_date}`, null)
  }

  for (const n of (notes.data ?? []) as Note[]) {
    if (!n.deleted_root) continue
    add('note', n, n.body.slice(0, 80) || 'Note', null)
  }

  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

/** Hard-delete one batch now, photos included. */
export async function purgeBatch(batchId: string): Promise<void> {
  await purgeWhere((table) =>
    supabase.from(table).select().eq('delete_batch_id', batchId),
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
  const [folders, experiments, pottings, pots, logs, notes] = await Promise.all([
    select('folders'),
    select('experiments'),
    select('pottings'),
    select('pots'),
    select('date_logs'),
    select('notes'),
  ])

  const rows = {
    folders: (folders.data ?? []) as Folder[],
    experiments: (experiments.data ?? []) as Experiment[],
    pottings: (pottings.data ?? []) as Potting[],
    pots: (pots.data ?? []) as Pot[],
    date_logs: (logs.data ?? []) as DateLog[],
    notes: (notes.data ?? []) as Note[],
  }

  const total =
    rows.folders.length +
    rows.experiments.length +
    rows.pottings.length +
    rows.pots.length +
    rows.date_logs.length +
    rows.notes.length
  if (total === 0) return 0

  // Collect photo URLs before the rows disappear.
  const urls = [
    ...rows.folders.map((f) => f.cover_image_url),
    ...rows.experiments.map((e) => e.cover_image_url),
    ...rows.pots.map((p) => p.image_url),
    ...rows.date_logs.map((l) => l.image_url),
    ...rows.notes.map((n) => n.image_url),
  ].filter((u): u is string => !!u)

  const byId = (table: BinTable, ids: string[]) =>
    ids.length === 0 ? null : supabase.from(table).delete().in('id', ids)

  // Parents first: deleting a folder cascades to its experiments, pottings,
  // pots and logs; a potting cascades to its pots and their logs.
  await byId(
    'folders',
    rows.folders.map((f) => f.id),
  )
  await byId(
    'experiments',
    rows.experiments.map((e) => e.id),
  )
  await byId(
    'pottings',
    rows.pottings.map((t) => t.id),
  )
  await byId(
    'pots',
    rows.pots.map((p) => p.id),
  )
  await byId(
    'date_logs',
    rows.date_logs.map((l) => l.id),
  )
  await byId(
    'notes',
    rows.notes.map((n) => n.id),
  )

  // Best effort: an orphaned image costs storage but shouldn't fail the purge.
  await removeStoredImages(urls)

  return total
}
