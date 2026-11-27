import { NextResponse } from 'next/server'
import { SHIFT_LEAD_SCOPE, SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import { withAuth } from '@/lib/api-auth'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { parseAuditDate } from '@/lib/audit-helpers'
import { validateCancelReason } from '@/lib/shifts/shift-tasks-view'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export const POST = withAuth(async (request, { supabase, accessToken }) => {
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel, SHIFT_TASK_VOICE.requiredAal)) {
    return fail('Potwierdź drugi składnik uwierzytelniania.', 403)
  }
  const input: unknown = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return fail('Niepoprawne dane rozliczenia.', 400)
  const { evidenceId, decision: requestedDecision, reason, targetShiftDefinitionId, targetDate } = input as Record<string, unknown>
  const decision = SHIFT_TASK_VOICE.decisions.find((value) => value === requestedDecision)
  if (typeof evidenceId !== 'string' || !uuid.test(evidenceId) || !decision) {
    return fail('Niepoprawne dane rozliczenia.', 400)
  }
  const cancellation = decision === 'CANCELLED' && typeof reason === 'string' ? reason.trim() : null
  const destination = decision === 'CARRIED' && typeof targetShiftDefinitionId === 'string'
    && uuid.test(targetShiftDefinitionId) ? targetShiftDefinitionId : null
  const date = decision === 'CARRIED' && typeof targetDate === 'string' ? parseAuditDate(targetDate) : null
  if (decision === 'CANCELLED') {
    const invalid = validateCancelReason(cancellation ?? '')
    if (invalid) return fail(invalid, 400)
  }
  if (decision === 'CARRIED' && (!destination || !date)) return fail('Wybierz zmianę i datę docelową.', 400)

  const { data, error } = await supabase.rpc('decide_shift_task_voice_suggestion', {
    p_evidence_id: evidenceId, p_decision: decision,
    p_reason: cancellation, p_target_definition_id: destination, p_target_date: date ?? null,
  })
  if (!error) return NextResponse.json({ taskId: data })
  if (error.code === '42501') return fail('Podpowiedź jest niedostępna.', 403)
  if (error.message.includes('SHIFT_CARRY_TARGET_INVALID')) return fail('Wybierz inną zmianę lub datę niż obecna.', 400)
  if (error.code === '23514') return fail('Stan zadania lub dowodu się zmienił. Odśwież listę.', 409)
  if (error.code === '22023') return fail('Wybierz decyzję zgodną z rodzajem podpowiedzi.', 400)
  console.error('[VOICE_TASK_DECISION_FAILED]', error.code)
  return fail('Nie udało się rozliczyć zadania.', 500)
}, {
  roles: ['org_admin', SHIFT_LEAD_SCOPE.role],
  requireOrganization: true,
  blockImpersonation: true,
  requiredFeature: SHIFT_TASK_VOICE.requiredFeatures,
})
