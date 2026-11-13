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
import type { Json, TablesInsert } from '@/types/database.types'

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
  client: ReturnType<typeof createClient> extends Promise<infer T> ? T : ReturnType<typeof createAdminClient>,
  residentId: string
): Promise<{ activeAssignment: BedAssignmentRow | null; bedLabel: string | null }> {
  const { data } = await client
    .from('bed_assignments')
    .select('id, bed_id, beds(label, rooms(number))')
    .eq('resident_id', residentId)
    .is('unassigned_at', null)

  const activeAssignment = ((data as unknown as BedAssignmentRow[]) || [])[0] || null
  const bed = activeAssignment?.beds
  const bedLabel = bed ? (bed.rooms?.number ? `Pokój ${bed.rooms.number}, Łóżko ${bed.label}` : `Łóżko ${bed.label}`) : null
  return { activeAssignment, bedLabel }
}

/**
 * Akcja serwerowa zakończenia pobytu / rejestracji zgonu podopiecznego (org_admin / super_admin)
 */
export async function dischargeResidentAction(payload: DischargePayloadInput): Promise<DischargeResidentResult> {
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

  const { activeAssignment, bedLabel } = await resolveActiveBed(adminClient, residentId)

  let updatedNotes = currentResident.notes || ''
  if (notes) {
    const timestampStr = new Date().toLocaleDateString('pl-PL')
    const notePrefix = contractEndReason === 'death' ? '[Zgon]' : '[Wypis]'
    updatedNotes = updatedNotes ? `${updatedNotes}\n${notePrefix} (${timestampStr}): ${notes}` : `${notePrefix} (${timestampStr}): ${notes}`
  }

  const { error: updateErr } = await adminClient.from('residents').update({
    contract_end_date: contractEndDate,
    contract_end_reason: contractEndReason,
    notes: updatedNotes || null,
    ...(deathDate ? { death_date: deathDate } : {}),
  }).eq('id', residentId)

  if (updateErr) return { success: false, error: `Błąd podczas zapisu wypisu: ${updateErr.message}` }

  await adminClient.from('resident_death_reports').delete().eq('resident_id', residentId)

  if (activeAssignment) {
    const { error: bedErr } = await adminClient
      .from('bed_assignments')
      .update({ unassigned_at: new Date().toISOString() })
      .eq('id', activeAssignment.id)
      .is('unassigned_at', null)
    if (bedErr) {
      console.error('[DISCHARGE_BED_UNASSIGN_FAIL]', bedErr.message)
      return { success: false, error: `Błąd podczas zwalniania łóżka: ${bedErr.message}` }
    }
  }

  const eventsToInsert: TablesInsert<'resident_events'>[] = [{
    organization_id: currentResident.organization_id,
    resident_id: residentId,
    event_type: 'contract_ended',
    event_date: contractEndDate,
    event_reason: contractEndReason,
    metadata: { unassigned_bed_id: activeAssignment?.bed_id || null },
    performed_by: user.id,
  }]
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
  const { error: eventsErr } = await adminClient.from('resident_events').insert(eventsToInsert)
  if (eventsErr) {
    console.error('[DISCHARGE_EVENTS_INSERT_FAIL]', eventsErr.message)
    return { success: false, error: `Błąd podczas zapisu zdarzenia pobytu: ${eventsErr.message}` }
  }

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

  for (const p of ['/admin/residents', `/admin/residents/${residentId}`, '/admin/facility', '/admin']) revalidatePath(p)
  return { success: true, unassignedBedLabel: bedLabel }
}

/**
 * Operacyjna inicjacja zgłoszenia zgonu przez personel opiekuńczy (nurse) [ADM-RESIDENT-LIFECYCLE-DISCHARGE]
 * Wykonywana atomowo w jednej transakcji RPC w kontekście sesji użytkownika (RLS, bez service_role).
 */
export async function initiateDeathDischargeAction(payload: DeathInitiationPayloadInput): Promise<DischargeResidentResult> {
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

  const { data: currentResident, error: fetchErr } = await supabase
    .from('residents')
    .select('id, organization_id, death_date, archived_at, resident_death_reports(reported_death_date)')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  if (currentResident.organization_id !== orgId) return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  if (currentResident.death_date) return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }
  const existingReport = Array.isArray(currentResident.resident_death_reports)
    ? currentResident.resident_death_reports[0]
    : currentResident.resident_death_reports
  if (existingReport) {
    return { success: false, error: 'Dla tego podopiecznego zarejestrowano już zgłoszenie zgonu (oczekuje na zatwierdzenie przez Kierownika placówki).' }
  }

  const { bedLabel } = await resolveActiveBed(supabase, residentId)
  const tasks = buildPostMortemSanitizationTasks({ residentId, targetDate: deathDate, bedLabel })

  const { error: rpcErr } = await supabase.rpc('report_resident_death_atomic', {
    p_resident_id: residentId,
    p_death_date: deathDate,
    p_notes: notes || null,
    p_tasks: tasks as unknown as Json,
  })
  if (rpcErr) {
    if (rpcErr.message.includes('DEATH_ALREADY_REPORTED')) {
      return { success: false, error: 'Dla tego podopiecznego zarejestrowano już zgłoszenie zgonu (oczekuje na zatwierdzenie przez Kierownika placówki).' }
    }
    if (rpcErr.message.includes('DEATH_ALREADY_CONFIRMED')) {
      return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }
    }
    return { success: false, error: `Błąd podczas rejestracji zgłoszenia: ${rpcErr.message}` }
  }

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin/facility', '/staff/agenda']) {
    revalidatePath(p)
  }
  return { success: true, unassignedBedLabel: null }
}
