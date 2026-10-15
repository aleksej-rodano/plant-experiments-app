import { daysBetween } from './insights'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local `yyyy-mm-dd` for a date. toISOString() would give the UTC day instead. */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's date in the user's timezone, as `yyyy-mm-dd`. */
export const today = () => isoDay(new Date())

/**
 * The three folder columns that describe a recurring chore. (`experiments`
 * still has the same columns in the database, but they're no longer used.)
 */
export interface CareSchedule {
  care_task_label: string | null
  care_interval_days: number | null
  care_last_done_on: string | null
}

export interface CareStatus {
  label: string
  intervalDays: number
  /** ISO date the task is next due. */
  dueOn: string
  /** Negative = overdue by that many days, 0 = due today, positive = days left. */
  daysUntilDue: number
  state: 'overdue' | 'due' | 'upcoming'
  /** Human summary, e.g. "Overdue by 2 days". */
  text: string
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDay(d)
}

/**
 * Where a recurring chore stands right now, for a folder. Null when no
 * schedule is set up.
 */
export function careStatus(row: CareSchedule): CareStatus | null {
  const interval = row.care_interval_days
  if (!interval || interval <= 0) return null

  const label = row.care_task_label?.trim() || 'Care task'
  // Never done yet: treat it as due today so it doesn't sit invisible forever.
  const from = row.care_last_done_on ?? today()
  const dueOn = addDays(from, interval)
  const daysUntilDue = daysBetween(today(), dueOn) ?? 0

  const state =
    daysUntilDue < 0 ? 'overdue' : daysUntilDue === 0 ? 'due' : 'upcoming'

  const text =
    state === 'overdue'
      ? `Overdue by ${Math.abs(daysUntilDue)} day${
          Math.abs(daysUntilDue) === 1 ? '' : 's'
        }`
      : state === 'due'
        ? 'Due today'
        : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`

  return { label, intervalDays: interval, dueOn, daysUntilDue, state, text }
}

// tertiary-container is the same red as error-container in this theme, so "due"
// uses the teal secondary instead to stay visibly distinct from "overdue".
export const CARE_TILE_CLASS: Record<CareStatus['state'], string> = {
  overdue: 'bg-error-container text-on-error-container',
  due: 'bg-secondary-container text-on-secondary-container',
  upcoming: 'bg-surface-container text-on-surface',
}

/** Common chores offered as autocomplete suggestions on the folder form. */
export const CARE_TASK_SUGGESTIONS = [
  'Change water',
  'Fertilize',
  'Mist',
  'Check roots',
  'Rotate towards light',
  'Repot',
]
