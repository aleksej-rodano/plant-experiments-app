import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import type { DateLog, Experiment } from '../../types/database'
import type { PhaseInput } from '../utils/phases'
import { usePottings } from './usePottings'

/**
 * One experiment with everything the Phase 1 / Phase 2 accounting needs: its
 * live logs, pottings and pots, folded into a `PhaseInput` for utils/phases.ts.
 * Used by the potting pages, which are opened directly and so cannot rely on
 * the detail page's already-loaded data.
 */
export function useExperimentPhases(
  experimentId: string | undefined,
  seeded?: Experiment | null,
) {
  const [experiment, setExperiment] = useState<Experiment | null>(
    seeded ?? null,
  )
  const [logs, setLogs] = useState<DateLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { pottings, pots, loading: pottingsLoading } = usePottings(
    experimentId ? [experimentId] : [],
  )

  useEffect(() => {
    if (!experimentId) return
    let cancelled = false
    void (async () => {
      const [expRes, logRes] = await Promise.all([
        supabase
          .from('experiments')
          .select()
          .eq('id', experimentId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('date_logs')
          .select()
          .eq('experiment_id', experimentId)
          .is('deleted_at', null)
          .order('log_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      if (expRes.error) setError(expRes.error.message)
      else if (!expRes.data) setError('Experiment not found.')
      else setExperiment(expRes.data)
      if (logRes.error) setError(logRes.error.message)
      else setLogs(logRes.data ?? [])
      setDataLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [experimentId])

  const phaseInput = useMemo<PhaseInput>(
    () => ({
      experiment: { plant_count: experiment?.plant_count ?? null },
      pottings,
      pots,
      logs,
    }),
    [experiment?.plant_count, pottings, pots, logs],
  )

  return {
    experiment,
    logs,
    pottings,
    pots,
    phaseInput,
    loading: dataLoading || pottingsLoading,
    error,
  }
}
