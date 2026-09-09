/**
 * Regression tests for the pure date / stage / survival helpers — the ones with
 * enough arithmetic in them to break quietly. Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { addDays, dayMs, daysBetween, isoDate, today } from '../src/lib/utils/date'
import { careStatus } from '../src/lib/utils/care'
import { stageEntry, stageWarnings, type StageEntry } from '../src/lib/utils/stages'
import { successRate, survivorCount, totalDeaths } from '../src/lib/utils/survival'

// vitest.config.ts pins TZ=Pacific/Auckland (UTC+12/+13). Fail loudly rather
// than silently passing in UTC, where local and UTC dates agree.
it('runs in the pinned timezone', () => {
  assert.equal(
    new Date('2026-09-10T00:00:00Z').getTimezoneOffset(),
    -720,
    'tests must run with TZ=Pacific/Auckland — see vitest.config.ts',
  )
})

describe('date helpers', () => {
  it('formats from local parts, not UTC', () => {
    // 09:00 in Auckland is still the previous day in UTC. toISOString() would
    // report 2026-09-09 here, which is what every `today()` in the app used to do.
    const morning = new Date('2026-09-10T09:00:00+12:00')
    assert.equal(isoDate(morning), '2026-09-10')
    assert.equal(morning.toISOString().slice(0, 10), '2026-09-09')
  })

  it('today() agrees with the local clock', () => {
    const now = new Date()
    assert.equal(today(), isoDate(now))
  })

  it('addDays stays on the local calendar', () => {
    assert.equal(addDays('2026-09-09', 3), '2026-09-12')
    assert.equal(addDays('2026-12-30', 3), '2027-01-02')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  })

  it('daysBetween counts whole days and tolerates a DST shift', () => {
    assert.equal(daysBetween('2026-09-09', '2026-09-12'), 3)
    assert.equal(daysBetween('2026-09-12', '2026-09-09'), -3)
    assert.equal(daysBetween(null, '2026-09-09'), null)
    // Auckland leaves DST on 2026-04-05; the span is 24h+1h of wall clock.
    assert.equal(daysBetween('2026-04-04', '2026-04-05'), 1)
  })

  it('dayMs reads a date as local midnight', () => {
    assert.equal(new Date(dayMs('2026-09-09')).getHours(), 0)
  })
})

describe('careStatus', () => {
  const base = { care_task_label: 'Change water', care_interval_days: 3 }

  it('is due today when the task has never been marked done', () => {
    // Regression: this used to anchor on today() and re-derive the due date on
    // every render, so the task read "due in 3 days" forever and never fired.
    const s = careStatus({ ...base, care_last_done_on: null })
    assert.ok(s)
    assert.equal(s.state, 'due')
    assert.equal(s.daysUntilDue, 0)
    assert.equal(s.dueOn, today())
  })

  it('counts forward from the last completion', () => {
    const s = careStatus({ ...base, care_last_done_on: addDays(today(), -1) })
    assert.ok(s)
    assert.equal(s.state, 'upcoming')
    assert.equal(s.daysUntilDue, 2)
  })

  it('reports overdue with a plural-correct summary', () => {
    const one = careStatus({ ...base, care_last_done_on: addDays(today(), -4) })
    assert.equal(one?.state, 'overdue')
    assert.equal(one?.text, 'Overdue by 1 day')

    const two = careStatus({ ...base, care_last_done_on: addDays(today(), -5) })
    assert.equal(two?.text, 'Overdue by 2 days')
  })

  it('is off without a positive interval', () => {
    assert.equal(careStatus({ ...base, care_interval_days: null, care_last_done_on: null }), null)
    assert.equal(careStatus({ ...base, care_interval_days: 0, care_last_done_on: null }), null)
  })
})

describe('stageEntry', () => {
  const blank = {
    log_date: '2026-09-09',
    created_at: '2026-09-09T00:00:00Z',
    deaths_count: 0,
    r0_count: null,
    r1_count: null,
    r2_count: null,
    s0_count: null,
    s1_count: null,
    s2_count: null,
    s3_count: null,
    leafing_without_rooting: null,
  }

  it('is null for a check-in that recorded no stage counts', () => {
    assert.equal(stageEntry(blank), null)
  })

  it('treats blank buckets in a touched entry as zero', () => {
    const e = stageEntry({ ...blank, r0_count: 5, s3_count: 2 })
    assert.ok(e)
    assert.deepEqual(e.root, [5, 0, 0])
    assert.deepEqual(e.shoot, [0, 0, 0, 2])
    assert.equal(e.rootTotal, 5)
    assert.equal(e.shootTotal, 2)
  })
})

describe('stageWarnings', () => {
  const entry = (over: Partial<StageEntry> = {}): StageEntry => ({
    root: [8, 0, 0],
    shoot: [8, 0, 0, 0],
    dead: 0,
    leafingWithoutRooting: 0,
    rootTotal: 8,
    shootTotal: 8,
    ...over,
  })

  it('stays quiet when earlier check-ins account for the missing plants', () => {
    // Regression: started with 10, lost 2 last week, 8 alive and 0 new deaths
    // today. Reconciling against this entry's deaths alone flagged every
    // check-in after the first loss.
    assert.deepEqual(stageWarnings(entry(), 10, 2), [])
  })

  it('still flags counts that genuinely do not add up', () => {
    const out = stageWarnings(entry(), 10, 0)
    assert.equal(out.length, 2)
    assert.match(out[0], /Root buckets \+ dead = 8, but the experiment started with 10/)
  })

  it('counts this entry’s deaths alongside the prior ones', () => {
    assert.deepEqual(stageWarnings(entry({ dead: 1 }), 10, 1), [])
  })

  it('says nothing without a plant count to reconcile against', () => {
    assert.deepEqual(stageWarnings(entry(), null, 0), [])
  })

  it('flags a leafing-without-rooting count the buckets cannot support', () => {
    const out = stageWarnings(
      entry({ root: [1, 0, 0], rootTotal: 1, shoot: [7, 1, 0, 0], leafingWithoutRooting: 5 }),
      8,
      0,
    )
    assert.ok(out.some((w) => /above the 1 that R0 and shoot counts allow/.test(w)))
  })
})

describe('survival', () => {
  it('sums per-entry deaths across the timeline', () => {
    assert.equal(totalDeaths([{ deaths_count: 2 }, { deaths_count: 0 }, { deaths_count: 1 }]), 3)
  })

  it('never reports negative survivors', () => {
    assert.equal(survivorCount(5, 9), 0)
    assert.equal(survivorCount(null, 1), 0)
  })

  it('has no rate without a denominator', () => {
    assert.equal(successRate(null, 0), null)
    assert.equal(successRate(0, 0), null)
    assert.equal(successRate(10, 2), 0.8)
  })
})
