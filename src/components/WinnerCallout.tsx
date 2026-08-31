import { Timer, Trophy } from 'lucide-react'
import { formatRate } from '../lib/utils/survival'
import {
  fastestToRoot,
  rankBySurvival,
  type ExperimentSummary,
} from '../lib/utils/insights'

interface Props {
  summaries: ExperimentSummary[]
}

/**
 * The one-line verdict on which treatment is ahead. Stays hidden until the data
 * can actually support a claim — two experiments with plant counts and a real
 * difference between them.
 */
export default function WinnerCallout({ summaries }: Props) {
  const ranked = rankBySurvival(summaries)
  const fastest = fastestToRoot(summaries)
  if (!ranked && !fastest) return null

  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">
      {ranked && (
        <p className="flex items-start gap-2">
          <Trophy className="mt-0.5 size-4 shrink-0" />
          <span>
            Best so far:{' '}
            <span className="font-medium">{ranked.best.experiment.title}</span> —{' '}
            {ranked.best.alive}/{ranked.best.initial} ({formatRate(ranked.best.rate)}
            ), vs {ranked.worst.experiment.title} at{' '}
            {formatRate(ranked.worst.rate)}.
          </span>
        </p>
      )}
      {fastest && (
        <p className="flex items-start gap-2">
          <Timer className="mt-0.5 size-4 shrink-0" />
          <span>
            Fastest to root:{' '}
            <span className="font-medium">{fastest.experiment.title}</span> —{' '}
            {fastest.daysToRoot} day{fastest.daysToRoot === 1 ? '' : 's'} from
            start.
          </span>
        </p>
      )}
    </div>
  )
}
