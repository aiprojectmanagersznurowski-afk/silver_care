'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import {
  validateDischargePayload,
  DischargePayloadInput,
} from '@/lib/discharge-helpers'

export interface DischargeResidentResult {
  success: boolean
  error?: string
  unassignedBedLabel?: string | null
}

interface BedWithRoomInfo {
  id: string
  label: string
  room_id: string
  rooms: {
    number: string
  } | null
}

interface BedAssignmentRow {
  id: string
  bed_id: string
  beds: BedWithRoomInfo | null
}

/**
 * Akcja serwerowa zakończenia pobytu / rejestracji zgonu pensjonariusza
 * Zgodnie z @REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE (Wariant B) oraz [SC-ADM-19]
 */
export async function dischargeResidentAction(
  payload: DischargePayloadInput
): Promise<DischargeResidentResult> {
  // 1. Walidacja formatu i poprawności danych wejściowych
  const validation = validateDischargePayload(payload)
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join(' ') }
  }

  const { residentId, contractEndDate, contractEndReason, deathDate, notes } = validation.data

  // 2. Sesja i uprawnienia
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Brak aktywnej sesji użytkownika.' }
  }

  // 3. Blokada w trybie podglądu (impersonacji Super Admina)
  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(
    isImpersonationSessionActive(cookieStore, user)
  )
  if (!guard.allowed) {
    return { success: false, error: guard.error }
  }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined

  const allowedRoles = ['org_admin', 'super_admin']
  if (!role || !allowedRoles.includes(role)) {
    return {
      success: false,
      error: 'Brak uprawnień do zakończenia pobytu (wymagana rola administratora placówki).',
    }
  }

  const adminClient = createAdminClient()

  // 4. Pobranie rekordu podopiecznego
  const { data: currentResident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, archived_at, contract_end_date, notes')
    .eq('id', residentId)
    .single()

  if (fetchErr || !currentResident) {
    return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  }

  // Izolacja tenantów (RLS guard)
  if (role !== 'super_admin' && currentResident.organization_id !== orgId) {
    return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  }

  // Sprawdzenie czy pensjonariusz nie ma już zarejestrowanego zgonu
  if (currentResident.death_date) {
    return { success: false, error: 'Dla tego podopiecznego zarejestrowano już fakt zgonu.' }
  }

  // 5. Pobranie aktywnego przypisania do łóżka
  const { data: activeAssignments } = await adminClient
    .from('bed_assignments')
    .select('id, bed_id, beds(id, label, room_id, rooms(number))')
    .eq('resident_id', residentId)
    .is('unassigned_at', null)

  const assignmentList = (activeAssignments as unknown as BedAssignmentRow[]) || []
  const activeAssignment = assignmentList.length > 0 ? assignmentList[0] : null

  let unassignedBedLabel: string | null = null
  if (activeAssignment?.beds) {
    const bed = activeAssignment.beds
    const roomNumber = bed.rooms?.number ? `Pokój ${bed.rooms.number}` : ''
    unassignedBedLabel = roomNumber ? `${roomNumber}, Łóżko ${bed.label}` : `Łóżko ${bed.label}`
  }

  // 6. Aktualizacja rekordu w residents (Wariant B: archived_at pozostaje null, rodzina ma wgląd read-only)
  let updatedNotes = currentResident.notes || ''
  if (notes) {
    const timestampStr = new Date().toLocaleDateString('pl-PL')
    const notePrefix = contractEndReason === 'death' ? '[Zgon]' : '[Wypis]'
    updatedNotes = updatedNotes
      ? `${updatedNotes}\n${notePrefix} (${timestampStr}): ${notes}`
      : `${notePrefix} (${timestampStr}): ${notes}`
  }

  interface ResidentUpdateFields {
    contract_end_date: string
    contract_end_reason: string
    notes: string | null
    death_date?: string | null
  }

  const updateResidentData: ResidentUpdateFields = {
    contract_end_date: contractEndDate,
    contract_end_reason: contractEndReason,
    notes: updatedNotes || null,
  }

  if (deathDate) {
    updateResidentData.death_date = deathDate
  }

  const { error: updateErr } = await adminClient
    .from('residents')
    .update(updateResidentData)
    .eq('id', residentId)

  if (updateErr) {
    return { success: false, error: `Błąd podczas zapisu wypisu: ${updateErr.message}` }
  }

  // 7. Atomowe zwolnienie łóżka (AC3)
  if (activeAssignment) {
    const nowIso = new Date().toISOString()
    const { error: bedErr } = await adminClient
      .from('bed_assignments')
      .update({ unassigned_at: nowIso })
      .eq('id', activeAssignment.id)
      .is('unassigned_at', null)

    if (bedErr) {
      console.error('[DISCHARGE_BED_UNASSIGN_FAIL]', bedErr.message)
    }
  }

  // 8. Rejestracja w resident_events na potrzeby modułu BI i raportów (AC5)
  interface ResidentEventInsert {
    organization_id: string
    resident_id: string
    event_type: 'contract_ended' | 'death'
    event_date: string
    event_reason: string | null
    metadata: Record<string, unknown>
    performed_by: string
  }

  const eventsToInsert: ResidentEventInsert[] = [
    {
      organization_id: currentResident.organization_id,
      resident_id: residentId,
      event_type: 'contract_ended',
      event_date: contractEndDate,
      event_reason: contractEndReason,
      metadata: {
        unassigned_bed_id: activeAssignment?.bed_id || null,
      },
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
      metadata: {
        has_discharge_notes: Boolean(notes),
      },
      performed_by: user.id,
    })
  }

  const { error: eventsErr } = await adminClient
    .from('resident_events')
    .insert(eventsToInsert)

  if (eventsErr) {
    console.error('[DISCHARGE_EVENTS_INSERT_FAIL]', eventsErr.message)
  }

  // 9. Rejestracja w audit_logs (bez danych osobowych / PII)
  await adminClient.from('audit_logs').insert({
    organization_id: currentResident.organization_id,
    user_id: user.id,
    action: 'RESIDENT_DISCHARGE',
    target_table: 'residents',
    target_id: residentId,
    details: {
      contract_end_reason: contractEndReason,
      is_death: contractEndReason === 'death',
      unassigned_bed_id: activeAssignment?.bed_id || null,
    },
  })

  // 10. Rewalidacja ścieżek
  revalidatePath('/admin/residents')
  revalidatePath(`/admin/residents/${residentId}`)
  revalidatePath('/admin/facility')
  revalidatePath('/admin')

  return {
    success: true,
    unassignedBedLabel,
  }
}
