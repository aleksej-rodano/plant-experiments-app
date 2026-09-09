/**
 * The bin's read model. `binEntries` is what decides whether a binned row is
 * offered back to the user at all, so the cases below are the ones where a row
 * used to fall out of the list entirely and get purged 30 days later without
 * ever having been shown.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { binEntries, type BinnedRows } from '../src/lib/utils/bin'
import type { DateLog, Experiment, Folder, Note } from '../src/types/database'

const AT = '2026-09-01T10:00:00.000Z'

const folder = (o: Partial<Folder> & { id: string }) =>
  ({ title: 'Folder', deleted_at: null, delete_batch_id: null, deleted_root: false, ...o }) as Folder
const experiment = (o: Partial<Experiment> & { id: string }) =>
  ({ title: 'Experiment', deleted_at: null, delete_batch_id: null, deleted_root: false, ...o }) as Experiment
const log = (o: Partial<DateLog> & { id: string }) =>
  ({ status_details: '', log_date: '2026-09-01', deleted_at: null, delete_batch_id: null, deleted_root: false, ...o }) as DateLog
const note = (o: Partial<Note> & { id: string }) =>
  ({ body: 'Note', deleted_at: null, delete_batch_id: null, deleted_root: false, ...o }) as Note

const rows = (o: Partial<BinnedRows>): BinnedRows => ({
  folders: [], experiments: [], date_logs: [], notes: [], ...o,
})

describe('binEntries', () => {
  it('shows one entry per delete action, not one per affected row', () => {
    const entries = binEntries(
      rows({
        folders: [folder({ id: 'f1', title: 'Monstera batch', deleted_at: AT, delete_batch_id: 'b1', deleted_root: true })],
        experiments: [experiment({ id: 'e1', deleted_at: AT, delete_batch_id: 'b1' })],
        date_logs: [
          log({ id: 'l1', deleted_at: AT, delete_batch_id: 'b1' }),
          log({ id: 'l2', deleted_at: AT, delete_batch_id: 'b1' }),
        ],
      }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].kind, 'folder')
    assert.equal(entries[0].label, 'Monstera batch')
    assert.equal(entries[0].batchId, 'b1')
    assert.match(entries[0].contains!, /1 experiment/)
    assert.match(entries[0].contains!, /2 log entries/)
  })

  it('still lists a batch whose root row was revived as an ancestor', () => {
    // Regression: binning experiment e1 stamps its logs with deleted_root=false.
    // Restoring a *separately* binned log then revives e1 and clears its batch
    // stamp, leaving l1/l2 binned with no flagged row. Keying off deleted_root
    // dropped them from the bin, and purgeExpired deleted them 30 days later.
    const entries = binEntries(
      rows({
        experiments: [experiment({ id: 'e1' })], // revived: deleted_at back to null
        date_logs: [
          log({ id: 'l1', status_details: 'Week 2', deleted_at: AT, delete_batch_id: 'b2' }),
          log({ id: 'l2', deleted_at: AT, delete_batch_id: 'b2' }),
        ],
      }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].kind, 'date_log')
    assert.equal(entries[0].batchId, 'b2')
    assert.equal(entries[0].label, 'Week 2')
    assert.match(entries[0].contains!, /1 log entry/)
  })

  it('still lists a folder batch whose folder was revived', () => {
    // Same shape one level up: restoring a separately-binned experiment revives
    // its folder, stranding the folder's *other* experiments and their logs.
    const entries = binEntries(
      rows({
        folders: [folder({ id: 'f1' })], // revived
        experiments: [
          experiment({ id: 'e2', title: 'Rooting powder', deleted_at: AT, delete_batch_id: 'b3' }),
          experiment({ id: 'e3', deleted_at: AT, delete_batch_id: 'b3' }),
        ],
        date_logs: [log({ id: 'l3', deleted_at: AT, delete_batch_id: 'b3' })],
      }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].kind, 'experiment')
    assert.equal(entries[0].label, 'Rooting powder')
    assert.match(entries[0].contains!, /1 experiment/)
    assert.match(entries[0].contains!, /1 log entry/)
  })

  it('surfaces a partly-applied bin, where nothing was ever flagged as root', () => {
    // binFolder stamps children first; if the folder update then fails, no row
    // in the batch carries deleted_root.
    const entries = binEntries(
      rows({
        experiments: [experiment({ id: 'e4', title: 'Control', deleted_at: AT, delete_batch_id: 'b4' })],
        date_logs: [log({ id: 'l4', deleted_at: AT, delete_batch_id: 'b4' })],
      }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].batchId, 'b4')
    assert.equal(entries[0].label, 'Control')
  })

  it('keeps separate delete actions separate', () => {
    const entries = binEntries(
      rows({
        date_logs: [
          log({ id: 'l5', status_details: 'First', deleted_at: AT, delete_batch_id: 'b5', deleted_root: true }),
          log({ id: 'l6', status_details: 'Second', deleted_at: '2026-09-02T10:00:00.000Z', delete_batch_id: 'b6', deleted_root: true }),
        ],
        notes: [note({ id: 'n1', body: 'A note', deleted_at: AT, delete_batch_id: 'b7', deleted_root: true })],
      }),
    )
    assert.equal(entries.length, 3)
    // Newest first.
    assert.equal(entries[0].label, 'Second')
    assert.deepEqual(entries.map((e) => e.batchId).sort(), ['b5', 'b6', 'b7'])
  })

  it('lists pre-batch rows individually, and marks them unrestorable', () => {
    const entries = binEntries(
      rows({ notes: [note({ id: 'n2', body: 'Legacy', deleted_at: AT, deleted_root: true })] }),
    )
    assert.equal(entries.length, 1)
    assert.equal(entries[0].batchId, null)
  })

  it('ignores live rows', () => {
    assert.deepEqual(
      binEntries(rows({ folders: [folder({ id: 'f9' })], notes: [note({ id: 'n9' })] })),
      [],
    )
  })

  it('labels a photo-only log entry by its date', () => {
    const entries = binEntries(
      rows({ date_logs: [log({ id: 'l7', status_details: '   ', log_date: '2026-08-14', deleted_at: AT, delete_batch_id: 'b8', deleted_root: true })] }),
    )
    assert.equal(entries[0].label, 'Log from 2026-08-14')
  })
})
