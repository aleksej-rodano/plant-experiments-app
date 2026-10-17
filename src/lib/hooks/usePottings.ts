import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Pot, Potting } from '../../types/database'

const NONE: { pottings: Potting[]; pots: Pot[] } = { pottings: [], pots: [] }

/**
 * Live pottings and pots for a set of experiments, for the Phase 1 / Phase 2
 * accounting in `utils/phases.ts`. A failed fetch leaves both lists empty, which
 * makes every screen behave as it did before potting existed.
 */
export function usePottings(experimentIds: string[], refreshKey?: unknown) {
  const [data, setData] = useState(NONE)
  const [loading, setLoading] = useState(true)
  const key = experimentIds.join(',')

  useEffect(() => {
    if (!key) {
      setData(NONE)
      setLoading(false)
      return
    }
    const ids = key.split(',')
    let cancelled = false
    setLoading(true)
    void (async () => {
      const [pottingRes, potRes] = await Promise.all([
        supabase
          .from('pottings')
          .select()
          .in('experiment_id', ids)
          .is('deleted_at', null),
        supabase
          .from('pots')
          .select()
          .in('experiment_id', ids)
          .is('deleted_at', null),
      ])
      if (cancelled) return
      const failed = pottingRes.error || potRes.error
      if (failed) console.error('Could not load pottings', failed.message)
      setData(
        failed
          ? NONE
          : { pottings: pottingRes.data ?? [], pots: potRes.data ?? [] },
      )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [key, refreshKey])

  return { ...data, loading }
}
