import { CARE_TASK_SUGGESTIONS } from '../lib/utils/care'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

interface Props {
  task: string
  onTask: (value: string) => void
  interval: string
  onInterval: (value: string) => void
  error?: string
}

/**
 * The "recurring reminder" fieldset shared by the folder and experiment forms:
 * a free-text chore (with common suggestions) and a repeat interval in days.
 * Leaving the days blank turns the reminder off.
 */
export default function CareScheduleFields({
  task,
  onTask,
  interval,
  onInterval,
  error,
}: Props) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-sm text-on-surface-variant">
        Recurring reminder
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Task
          <input
            type="text"
            list="care-task-suggestions"
            value={task}
            onChange={(e) => onTask(e.target.value)}
            placeholder="e.g. Fertilize"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Every … days
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={interval}
            onChange={(e) => onInterval(e.target.value)}
            placeholder="7"
            className={inputClass}
          />
          {error && <span className="text-xs text-error">{error}</span>}
        </label>
      </div>
      <datalist id="care-task-suggestions">
        {CARE_TASK_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className="text-xs text-on-surface-variant">
        Leave the days blank to turn the reminder off.
      </p>
    </fieldset>
  )
}
