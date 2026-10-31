'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import {
  validateDischargePayload,
  DischargePayloadInput,
  validateDeathInitiationPayload,
  DeathInitiationPayloadInput,
  canInitiateDeathProcedure,
  buildPostMortemSanitizationTasks,
} from '@/lib/discharge-helpers'
import type { TablesInsert } from '@/types/database.types'

export interface DischargeResidentResult {
  success: boolean
  error?: string
  unassignedBedLabel?: string | null
}

interface BedAssignmentRow {
  id: string
  bed_id: string
  beds: { label: string; rooms: { number: string } | null } | null
}

async function resolveActiveBed(
  adminClient: ReturnType<typeof createAdminClient>,
  residentId: string,
  unassign: boolean
): Promise<{ activeAssignment: BedAssignmentRow | null; bedLabel: string | null }> {
  const { data } = await adminClient
    .from('bed_assignments')
    .select('id, bed_id, beds(label, rooms(number))')
    .eq('resident_id', residentId)
    .is('unassigned_at', null)

  const activeAssignment = ((data as unknown as BedAssignmentRow[]) || [])[0] || null
  const bed = activeAssignment?.beds
  const bedLabel = bed ? (bed.rooms?.number ? `Pokój ${bed.rooms.number}, Łóżko ${bed.label}` : `Łóżko ${bed.label}`) : null

  if (unassign && activeAssignment) {
    await adminClient.from('bed_assignments').update({ unassigned_at: new Date().toISOString() }).eq('id', activeAssignment.id)
  }
  return { activeAssignment, bedLabel }
}

/**
 * Akcja serwerowa zakończenia pobytu / rejestracji zgonu podopiecznego (org_admin / super_admin)
 * Zgodnie z @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE (Wariant B) oraz [SC-ADM-19]
 */
export async function dischargeResidentAction(
  payload: DischargePayloadInput
): Promise<DischargeResidentResult> {
  const validation = validateDischargePayload(payload)
  if (!validation.isValid) return { success: false, error: validation.errors.join(' ') }

  const { residentId, contractEndDate, contractEndReason, deathDate, notes } = validation.data
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) return { success: false, error: guard.error }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!role || !['org_admin', 'super_admin'].includes(role)) {
    return { success: false, error: 'Brak uprawnień do zakończenia pobytu (wymagana rola Kierownika placówki).' }
  }

  const adminClient = createAdminClient()
  const { data: currentResident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, archived_at, contract_end_date, notes')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  if (role !== 'super_admin' && currentResident.organization_id !== orgId) {
    return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  }
  if (currentResident.death_date) return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }

  const { activeAssignment, bedLabel } = await resolveActiveBed(adminClient, residentId, true)

  let updatedNotes = currentResident.notes || ''
  if (notes) {
    const timestampStr = new Date().toLocaleDateString('pl-PL')
    const notePrefix = contractEndReason === 'death' ? '[Zgon]' : '[Wypis]'
    updatedNotes = updatedNotes ? `${updatedNotes}\n${notePrefix} (${timestampStr}): ${notes}` : `${notePrefix} (${timestampStr}): ${notes}`
  }

  const { error: updateErr } = await adminClient
    .from('residents')
    .update({
      contract_end_date: contractEndDate,
      contract_end_reason: contractEndReason,
      notes: updatedNotes || null,
      death_reported_at: null,
      ...(deathDate ? { death_date: deathDate } : {}),
    })
    .eq('id', residentId)

  if (updateErr) return { success: false, error: `Błąd podczas zapisu wypisu: ${updateErr.message}` }

  const eventsToInsert: TablesInsert<'resident_events'>[] = [
    {
      organization_id: currentResident.organization_id,
      resident_id: residentId,
      event_type: 'contract_ended',
      event_date: contractEndDate,
      event_reason: contractEndReason,
      metadata: { unassigned_bed_id: activeAssignment?.bed_id || null },
      performed_by: user.id,
    },
  ]
  if (contractEndReason === 'death' && deathDate) {
    eventsToInsert.push({
      organization_id: currentResident.organization_id,
      resident_id: residentId,
      event_type: 'death',
      event_date: deathDate,
      event_reason: 'death',
      metadata: { has_discharge_notes: Boolean(notes) },
      performed_by: user.id,
    })
  }
  await adminClient.from('resident_events').insert(eventsToInsert)

  await adminClient.from('audit_logs').insert({
    organization_id: currentResident.organization_id,
    performed_by: user.id,
    action: 'RESIDENT_DISCHARGE',
    payload: {
      target_table: 'residents',
      target_id: residentId,
      contract_end_reason: contractEndReason,
      is_death: contractEndReason === 'death',
      unassigned_bed_id: activeAssignment?.bed_id || null,
    },
  })

  for (const p of ['/admin/residents', `/admin/residents/${residentId}`, '/admin/facility', '/admin']) {
    revalidatePath(p)
  }
  return { success: true, unassignedBedLabel: bedLabel }
}

/**
 * Operacyjna inicjacja zgłoszenia zgonu przez personel opiekuńczy (nurse) [ADM-RESIDENT-LIFECYCLE-DISCHARGE]
 */
export async function initiateDeathDischargeAction(
  payload: DeathInitiationPayloadInput
): Promise<DischargeResidentResult> {
  const validation = validateDeathInitiationPayload(payload)
  if (!validation.isValid) return { success: false, error: validation.errors.join(' ') }

  const { residentId, deathDate, notes } = validation.data
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)
  const guard = assertMutationAllowedDuringImpersonation(isImpersonating)
  if (!guard.allowed) return { success: false, error: guard.error }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!canInitiateDeathProcedure(role, isImpersonating)) {
    return { success: false, error: 'Brak uprawnień do operacyjnego zgłoszenia zgonu.' }
  }

  const adminClient = createAdminClient()
  const { data: currentResident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, death_reported_at, archived_at')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  if (currentResident.organization_id !== orgId) return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  if (currentResident.death_date) return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }
  if (currentResident.death_reported_at) {
    return { success: false, error: 'Dla tego podopiecznego zarejestrowano już zgłoszenie zgonu (oczekuje na zatwierdzenie przez Kierownika placówki).' }
  }

  // Ustalamy łóżko pod kątem zadań sanityzacji (nie zwalniamy go — zwolni je Kierownik przy zatwierdzeniu)
  const { activeAssignment, bedLabel } = await resolveActiveBed(adminClient, residentId, false)

  const { error: updateErr } = await adminClient
    .from('residents')
    .update({ death_reported_at: new Date().toISOString() })
    .eq('id', residentId)

  if (updateErr) return { success: false, error: `Błąd podczas rejestracji zgłoszenia: ${updateErr.message}` }

  await adminClient.from('resident_events').insert({
    organization_id: currentResident.organization_id,
    resident_id: residentId,
    event_type: 'death_reported',
    event_date: deathDate,
    event_reason: 'death_reported',
    metadata: { notes: notes || null, death_date: deathDate },
    performed_by: user.id,
  })

  const tasks = buildPostMortemSanitizationTasks({ residentId, targetDate: deathDate, bedLabel })
  await adminClient.from('agenda_items').insert(
    tasks.map((t) => ({ ...t, organization_id: currentResident.organization_id }))
  )

  await adminClient.from('audit_logs').insert({
    organization_id: currentResident.organization_id,
    performed_by: user.id,
    action: 'RESIDENT_DEATH_REPORTED',
    payload: {
      target_table: 'residents',
      target_id: residentId,
      has_bed_assignment: Boolean(activeAssignment),
      sanitization_required: true,
    },
  })

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin/facility', '/staff/agenda']) {
    revalidatePath(p)
  }
  return { success: true, unassignedBedLabel: bedLabel }
}

