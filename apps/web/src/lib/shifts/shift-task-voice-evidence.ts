import type { SupabaseClient } from '@supabase/supabase-js'
import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import type { Database } from '@/types/database.types'
import { isOrgFeatureEnabled } from '@/lib/feature-flags'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'

type EvidenceRow = Database['public']['Tables'][typeof SHIFT_TASK_VOICE.resource]['Row']
export type ShiftTaskVoiceEvidence = Pick<EvidenceRow,
  'id' | 'task_id' | 'task_updated_at' | 'kind' | 'quote' | 'source_kind' | 'author_attribution' | 'recorded_at'>
export type VoiceTaskDecision = (typeof SHIFT_TASK_VOICE.decisions)[number]

export async function loadShiftTaskVoiceEvidence(
  supabase: SupabaseClient<Database>, organizationId: string, shiftId: string, date: string,
) {
  const enabled = await isOrgFeatureEnabled(supabase, organizationId, SHIFT_TASK_VOICE.requiredFeatures[0])
  if (!enabled) return { rows: [] }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel, SHIFT_TASK_VOICE.requiredAal)) {
    return { rows: [], mfa: { needsVerification: assurance?.nextLevel === SHIFT_TASK_VOICE.requiredAal } }
  }

  const { data, error } = await supabase.from(SHIFT_TASK_VOICE.resource)
    .select('id, task_id, task_updated_at, kind, quote, source_kind, author_attribution, recorded_at')
    .eq('organization_id', organizationId).eq('shift_definition_id', shiftId).eq('shift_date', date)
    .is('decided_at', null).order('recorded_at', { ascending: false }).order('id')
  if (error) console.error('[VOICE_TASK_EVIDENCE_LOAD_FAILED]', error.code)
  return { rows: data ?? [], unavailable: Boolean(error) }
}
