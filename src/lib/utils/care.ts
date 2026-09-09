import { addDays, daysBetween, today } from './date'

export { today }

/**
 * The three columns that describe a recurring chore. Both `folders` and
 * `experiments` carry this shape, so `careStatus` works on either.
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

/**
 * Where a recurring chore stands right now, for a folder or an experiment. Null
 * when no schedule is set up.
 */
export function careStatus(row: CareSchedule): CareStatus | null {
  const interval = row.care_interval_days
  if (!interval || interval <= 0) return null

  const label = row.care_task_label?.trim() || 'Care task'
  const now = today()
  // Never done yet: due today. Anchoring on `today()` instead would re-derive
  // the due date from a moving base every render, pushing it forward one day
  // every day -- the task would read "due in N days" forever and never fire.
  const dueOn = row.care_last_done_on
    ? addDays(row.care_last_done_on, interval)
    : now
  const daysUntilDue = daysBetween(now, dueOn) ?? 0

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
