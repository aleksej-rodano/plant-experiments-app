import type { DateLog, Experiment, Folder } from '../../types/database'

/**
 * RFC 4180 field escaping: wrap in quotes when the value contains a comma,
 * quote, or newline, and double any embedded quotes.
 */
function cell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
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
  return new Date().toISOString().slice(0, 10)
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
  URL.revokeObjectURL(url)
}

const LOG_HEADERS = [
  'log_date',
  'status_details',
  'root_length_mm',
  'new_leaves',
  'deaths_count',
  'death_cause',
  'image_url',
]

function logCells(log: DateLog): unknown[] {
  return [
    log.log_date,
    log.status_details,
    log.root_length_mm,
    log.new_leaves,
    log.deaths_count,
    log.death_cause,
    log.image_url,
  ]
}

/** One row per log entry for a single experiment. */
export function exportExperimentToCSV(
  experiment: Experiment,
  logs: DateLog[],
  folder?: Folder | null,
): void {
  const headers = ['folder', 'experiment', 'plant_count', ...LOG_HEADERS]
  const rows = logs.map((log) => [
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
