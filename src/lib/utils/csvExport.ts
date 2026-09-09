import type { DateLog, Experiment, Folder } from '../../types/database'
import { today } from './date'

/**
 * RFC 4180 field escaping: wrap in quotes when the value contains a comma,
 * quote, or newline, and double any embedded quotes.
 *
 * Values that open with =, +, - or @ are additionally prefixed with a single
 * quote. Spreadsheets read those as the start of a formula whether or not the
 * field is quoted, so a note typed as `=HYPERLINK(...)` would otherwise execute
 * when the exported sheet is opened. The prefix is the standard neutraliser and
 * is not displayed by Excel or Sheets.
 */
function cell(value: unknown): string {
  if (value == null) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  )
}

function stamp() {
  return today()
}

/** Trigger a client-side download of `text` as a CSV file. */
export function downloadCsv(text: string, filename: string): void {
  // The BOM makes Excel open UTF-8 accented characters correctly.
  const blob = new Blob([`﻿${text}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Deferred: revoking in the same tick cancels the download in some browsers,
  // which have only queued the fetch by the time click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const LOG_HEADERS = [
  'log_date',
  'status_details',
  'watered',
  'fertilized',
  'r0_count',
  'r1_count',
  'r2_count',
  's0_count',
  's1_count',
  's2_count',
  's3_count',
  'leafing_without_rooting',
  'deaths_count',
  'death_cause',
  'image_url',
]

function logCells(log: DateLog): unknown[] {
  return [
    log.log_date,
    log.status_details,
    log.watered,
    log.fertilized,
    log.r0_count,
    log.r1_count,
    log.r2_count,
    log.s0_count,
    log.s1_count,
    log.s2_count,
    log.s3_count,
    log.leafing_without_rooting,
    log.deaths_count,
    log.death_cause,
    log.image_url,
  ]
}

/** Oldest check-in first, ties broken by insertion order — as the PDF reads. */
function chronological(logs: DateLog[]): DateLog[] {
  return [...logs].sort(
    (a, b) =>
      a.log_date.localeCompare(b.log_date) ||
      a.created_at.localeCompare(b.created_at),
  )
}

/**
 * One row per log entry for a single experiment.
 *
 * Sorts its own input: the caller may be handing over the timeline's list,
 * which is newest-first for display.
 */
export function exportExperimentToCSV(
  experiment: Experiment,
  logs: DateLog[],
  folder?: Folder | null,
): void {
  const headers = ['folder', 'experiment', 'plant_count', ...LOG_HEADERS]
  const rows = chronological(logs).map((log) => [
    folder?.title ?? '',
    experiment.title,
    experiment.plant_count,
    ...logCells(log),
  ])
  downloadCsv(
    toCsv(headers, rows),
    `${slugify(experiment.title)}-${stamp()}.csv`,
  )
}

/**
 * Every experiment in a folder in one sheet, experiment name as a column so the
 * whole batch can be pivoted or filtered in a spreadsheet.
 */
export function exportFolderToCSV(
  folder: Folder,
  experiments: Experiment[],
  logs: DateLog[],
): void {
  const byId = new Map(experiments.map((e) => [e.id, e]))
  const headers = [
    'folder',
    'experiment',
    'experiment_started_on',
    'experiment_status',
    'plant_count',
    ...LOG_HEADERS,
  ]

  const ordered = [...logs].sort((a, b) => {
    const ea = byId.get(a.experiment_id)?.title ?? ''
    const eb = byId.get(b.experiment_id)?.title ?? ''
    return ea.localeCompare(eb) || a.log_date.localeCompare(b.log_date)
  })

  const rows = ordered.map((log) => {
    const exp = byId.get(log.experiment_id)
    return [
      folder.title,
      exp?.title ?? '',
      exp?.started_on ?? '',
      exp?.status ?? '',
      exp?.plant_count,
      ...logCells(log),
    ]
  })

  // Experiments with no logs yet would vanish entirely; keep a bare row for each
  // so the sheet still accounts for every treatment in the batch.
  for (const exp of experiments) {
    if (ordered.some((l) => l.experiment_id === exp.id)) continue
    rows.push([
      folder.title,
      exp.title,
      exp.started_on,
      exp.status,
      exp.plant_count,
      ...LOG_HEADERS.map(() => ''),
    ])
  }

  downloadCsv(toCsv(headers, rows), `${slugify(folder.title)}-${stamp()}.csv`)
}
