'use server'

import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { revalidatePath } from 'next/cache'
import { authorizeShiftStaff, getShiftStaffAccess } from '@/lib/api-auth'
import { parseAuditDate } from '@/lib/audit-helpers'
import type { HandoverCompleteness } from '@/lib/shifts/shift-handover'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

interface ApprovalInput {
  shiftId: string
  date: string
  revision: string
  completeness: HandoverCompleteness
  reason: string
}

/** @REQ: NUR-SHIFT-CLOSURE */
export async function approveShiftHandoverAction(input: ApprovalInput) {
  const { shiftId, date, revision, completeness, reason } = input
  if (!uuid.test(shiftId) || !parseAuditDate(date) || !/^[0-9a-f]{64}$/.test(revision)
    || !SHIFT_TASK_POLICY.closure.completeness.includes(completeness)
    || typeof reason !== 'string' || reason.length > 500) {
    return { error: 'Sprawdź dane przekazania.' }
  }

  const session = await authorizeShiftStaff()
  if (!session || await getShiftStaffAccess(session, shiftId, date) !== 'manage') {
    return { error: 'Przekazanie zatwierdza kierownik właściwej zmiany lub placówki.' }
  }

  const { error } = await session.supabase.rpc('approve_shift_handover', {
    p_shift: shiftId, p_date: date, p_revision: revision, p_completeness: completeness,
    p_reason: reason, p_expected_source_ids: [],
  })
  if (error) {
    if (error.message.includes('SHIFT_HANDOVER_REASON_REQUIRED')) return { error: 'Podaj powód częściowego zatwierdzenia.' }
    if (error.message.includes('SHIFT_HANDOVER_EVIDENCE_REQUIRED')) return { error: 'Kompletność wymaga niezależnego wykazu wysyłki oraz potwierdzenia jego przyjęcia i przetworzenia.' }
    if (error.message.includes('SHIFT_HANDOVER_KNOWN_GAP')) return { error: 'Wykryto brak w materiale. Zatwierdź wersję częściową z powodem.' }
    if (error.message.includes('SHIFT_HANDOVER_STALE') || error.code === '40P01') {
      return { error: 'Materiał się zmienił. Odśwież stronę i sprawdź aktualną wersję.' }
    }
    console.error('[SHIFT_HANDOVER_APPROVAL_FAILED]', error.code)
    return { error: 'Nie udało się zatwierdzić przekazania.' }
  }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}
