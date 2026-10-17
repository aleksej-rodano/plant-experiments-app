import { supabase } from '../supabase'
import { today } from './care'
import type { LogPhase, Pot, Potting } from '../../types/database'

/**
 * Phase 2 log plumbing shared by the date-log form, the quick-photo page and the
 * per-pot buttons. Every Phase 2 row (`phase = 'potted'`) belongs to exactly one
 * pot — the DB enforces it with a CHECK — so each helper here takes a pot id.
 *
 * URL shapes (Stage 6 links into these):
 *   /experiments/:id/logs/new?phase=potted&pot=<potId>   full Phase 2 check-in form
 *   /experiments/:id/logs/photo?pot=<potId>              Phase 2 quick photo
 * Without `phase=potted` the add form is the Phase 1 form (the default).
 */

export function potLogNewPath(experimentId: string, potId?: string | null) {
  const q = new URLSearchParams({ phase: 'potted' })
  if (potId) q.set('pot', potId)
  return `/experiments/${experimentId}/logs/new?${q.toString()}`
}

export function potPhotoPath(experimentId: string, potId: string) {
  return `/experiments/${experimentId}/logs/photo?pot=${potId}`
}

export function phaseFromParams(params: URLSearchParams): LogPhase {
  return params.get('phase') === 'potted' ? 'potted' : 'propagation'
}

/** `potted_on` of a pot's potting, or null when the potting is not live. */
export function pottedOnOf(
  pot: Pick<Pot, 'potting_id'> | undefined,
  pottings: Pick<Potting, 'id' | 'potted_on'>[],
): string | null {
  if (!pot) return null
  return pottings.find((p) => p.id === pot.potting_id)?.potted_on ?? null
}

/** One-tap "watered" / "fertilized" for a pot, dated today. */
export async function logPotCare(
  experimentId: string,
  potId: string,
  kind: 'watered' | 'fertilized',
) {
  const { error } = await supabase.from('date_logs').insert({
    experiment_id: experimentId,
    log_date: today(),
    status_details: '',
    deaths_count: 0,
    phase: 'potted',
    pot_id: potId,
    watered: kind === 'watered',
    fertilized: kind === 'fertilized',
  })
  if (error) throw error
}
