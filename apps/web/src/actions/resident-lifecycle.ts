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
  formatDeathInitiationNote,
} from '@/lib/discharge-helpers'
import type { TablesInsert } from '@/types/database.types'

export interface DischargeResidentResult {
  success: boolean
  error?: string
  unassignedBedLabel?: string | null
}

interface BedWithRoomInfo {
  id: string
  label: string
  room_id: string
  rooms: { number: string } | null
}

interface BedAssignmentRow {
  id: string
  bed_id: string
  beds: BedWithRoomInfo | null
}

async function releaseActiveBed(
  adminClient: ReturnType<typeof createAdminClient>,
  residentId: string
): Promise<{ activeAssignment: BedAssignmentRow | null; unassignedBedLabel: string | null }> {
  const { data: activeAssignments } = await adminClient
    .from('bed_assignments')
    .select('id, bed_id, beds(id, label, room_id, rooms(number))')
    .eq('resident_id', residentId)
    .is('unassigned_at', null)

  const list = (activeAssignments as unknown as BedAssignmentRow[]) || []
  const activeAssignment = list.length > 0 ? list[0] : null
  let unassignedBedLabel: string | null = null

  if (activeAssignment?.beds) {
    const bed = activeAssignment.beds
    const roomNumber = bed.rooms?.number ? `Pokój ${bed.rooms.number}` : ''
    unassignedBedLabel = roomNumber ? `${roomNumber}, Łóżko ${bed.label}` : `Łóżko ${bed.label}`
  }

  if (activeAssignment) {
    const { error: bedErr } = await adminClient
      .from('bed_assignments')
      .update({ unassigned_at: new Date().toISOString() })
      .eq('id', activeAssignment.id)
      .is('unassigned_at', null)

    if (bedErr) {
      console.error('[DISCHARGE_BED_UNASSIGN_FAIL]', bedErr.message)
    }
  }

  return { activeAssignment, unassignedBedLabel }
}

/**
 * Akcja serwerowa zakończenia pobytu / rejestracji zgonu pensjonariusza (org_admin / super_admin)
 * Zgodnie z @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE (Wariant B) oraz [SC-ADM-19]
 */
export async function dischargeResidentAction(
  payload: DischargePayloadInput
): Promise<DischargeResidentResult> {
  const validation = validateDischargePayload(payload)
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(' ') }
  }

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
    return { success: false, error: 'Brak uprawnień do zakończenia pobytu (wymagana rola administratora placówki).' }
  }

  const adminClient = createAdminClient()
  const { data: currentResident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, archived_at, contract_end_date, notes')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) {
    return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  }
  if (role !== 'super_admin' && currentResident.organization_id !== orgId) {
    return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  }
  if (currentResident.death_date) {
    return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }
  }

  const { activeAssignment, unassignedBedLabel } = await releaseActiveBed(adminClient, residentId)

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
  return { success: true, unassignedBedLabel }
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
    .select('id, organization_id, death_date, archived_at, notes')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  if (currentResident.organization_id !== orgId) return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  if (currentResident.death_date) return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }

  const { activeAssignment, unassignedBedLabel } = await releaseActiveBed(adminClient, residentId)
  const updatedNotes = formatDeathInitiationNote({ existingNotes: currentResident.notes, deathDate, unassignedBedLabel, notes })
  await adminClient.from('residents').update({ notes: updatedNotes }).eq('id', residentId)

  const tasks = buildPostMortemSanitizationTasks({ residentId, targetDate: deathDate, bedLabel: unassignedBedLabel })
  await adminClient.from('agenda_items').insert(
    tasks.map((t) => ({ ...t, organization_id: currentResident.organization_id }))
  )

  await adminClient.from('audit_logs').insert({
    organization_id: currentResident.organization_id,
    performed_by: user.id,
    action: 'RESIDENT_DEATH_INITIATED',
    payload: {
      target_table: 'residents',
      target_id: residentId,
      death_date: deathDate,
      unassigned_bed_id: activeAssignment?.bed_id || null,
      sanitization_required: true,
    },
  })

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin/facility', '/staff/agenda']) {
    revalidatePath(p)
  }
  return { success: true, unassignedBedLabel }
}

