import type {
  DateLog,
  Experiment,
  Folder,
  Pot,
  Potting,
} from '../../types/database'
import { potAlive } from './phases'

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
  'phase',
  'pot_label',
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
  'health_good',
  'health_ok',
  'health_poor',
  'image_url',
]

/** Phase 2 rows name their pot; Phase 1 rows leave the label blank. */
function logCells(log: DateLog, potLabels: Map<string, string>): unknown[] {
  return [
    log.log_date,
    log.phase ?? 'propagation',
    log.pot_id ? (potLabels.get(log.pot_id) ?? '') : '',
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
    log.health_good,
    log.health_ok,
    log.health_poor,
    log.image_url,
  ]
}

function potLabelMap(pots: Pot[]) {
  return new Map(pots.map((p) => [p.id, p.label]))
}

const POT_HEADERS = [
  'folder',
  'experiment',
  'potting_date',
  'pot_label',
  'plants_in_pot',
  'plants_alive',
  'pot_size',
  'substrate',
  'potting_notes',
  'pot_notes',
  'image_url',
]

/**
 * One row per pot, as a second sheet. The log sheet only carries the pot label;
 * everything about the pot itself (size, substrate, photo, how many plants went
 * in and how many are still alive) lives here. Nothing is downloaded for
 * experiments without pots.
 */
function exportPotsToCSV(
  filename: string,
  folderTitle: string,
  experiments: Experiment[],
  logs: DateLog[],
  pottings: Potting[],
  pots: Pot[],
): void {
  const pottingById = new Map(pottings.map((t) => [t.id, t]))
  const expById = new Map(experiments.map((e) => [e.id, e]))
  const rows = pots
    .filter((p) => !p.deleted_at && pottingById.has(p.potting_id))
    .map((pot) => {
      const potting = pottingById.get(pot.potting_id)!
      const exp = expById.get(pot.experiment_id)
      const input = {
        experiment: { plant_count: exp?.plant_count ?? null },
        pottings,
        pots,
        logs: logs.filter((l) => l.experiment_id === pot.experiment_id),
      }
      return {
        sort: [exp?.title ?? '', potting.potted_on, pot.created_at],
        row: [
          folderTitle,
          exp?.title ?? '',
          potting.potted_on,
          pot.label,
          pot.plant_count,
          potAlive(input, pot),
          pot.pot_size,
          pot.substrate,
          potting.notes,
          pot.notes,
          pot.image_url,
        ],
      }
    })
    .sort((a, b) =>
      a.sort.join('|').localeCompare(b.sort.join('|')),
    )
    .map((r) => r.row)
  if (rows.length === 0) return
  // Two downloads back to back: the second waits a beat so browsers that allow
  // "multiple downloads" per click don't drop it.
  setTimeout(() => downloadCsv(toCsv(POT_HEADERS, rows), filename), 400)
}

/** One row per log entry for a single experiment. */
export function exportExperimentToCSV(
  experiment: Experiment,
  logs: DateLog[],
  folder?: Folder | null,
  pottings: Potting[] = [],
  pots: Pot[] = [],
): void {
  const headers = ['folder', 'experiment', 'plant_count', ...LOG_HEADERS]
  const labels = potLabelMap(pots)
  const rows = logs.map((log) => [
    folder?.title ?? '',
    experiment.title,
    experiment.plant_count,
    ...logCells(log, labels),
  ])
  const base = `${slugify(experiment.title)}-${stamp()}`
  downloadCsv(toCsv(headers, rows), `${base}.csv`)
  exportPotsToCSV(
    `${base}-pots.csv`,
    folder?.title ?? '',
    [experiment],
    logs,
    pottings,
    pots,
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
  pottings: Potting[] = [],
  pots: Pot[] = [],
): void {
  const labels = potLabelMap(pots)
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
      ...logCells(log, labels),
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

  const base = `${slugify(folder.title)}-${stamp()}`
  downloadCsv(toCsv(headers, rows), `${base}.csv`)
  exportPotsToCSV(
    `${base}-pots.csv`,
    folder.title,
    experiments,
    logs,
    pottings,
    pots,
  )
}
