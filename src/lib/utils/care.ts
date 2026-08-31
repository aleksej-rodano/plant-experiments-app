import type { Folder } from '../../types/database'
import { daysBetween } from './insights'

export const today = () => new Date().toISOString().slice(0, 10)

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
  // Format from local parts: toISOString() would shift the date across timezones.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Where a folder's recurring chore stands right now. Null when no schedule is
 * set up, or when it's set up but has never been marked done.
 */
export function careStatus(folder: Folder): CareStatus | null {
  const interval = folder.care_interval_days
  if (!interval || interval <= 0) return null

  const label = folder.care_task_label?.trim() || 'Care task'
  // Never done yet: treat it as due today so it doesn't sit invisible forever.
  const from = folder.care_last_done_on ?? today()
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
