'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { parseNationalId, suggestBeds, BedCandidate, BedSuggestion } from '@/lib/admission-helpers'
import { encryptNationalId } from '@/lib/identity_crypto'
import crypto from 'crypto'

function hashNationalId(value: string, salt: string = 'silvercare_pesel_salt'): string {
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

interface ActiveAssignmentRecord {
  bed_id: string
  resident_id: string
  residents: { gender: string } | null
}

interface RoomRecord {
  id: string
  number: string
  floor: string | null
  beds: Array<{ id: string; label: string; is_active: boolean }> | null
}

export async function getBedSuggestionsAction(residentGender: 'M' | 'F', careLevel: 'walking' | 'sitting' | 'bedridden' | 'hospice'): Promise<{
  error?: string
  suggestions?: BedSuggestion[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzacji.' }

  const orgId = user.app_metadata?.organization_id
  if (!orgId) return { error: 'Brak identyfikatora placówki.' }

  const adminClient = createAdminClient()

  // Pobierz pokoje i łóżka
  const { data: rooms, error: roomsErr } = await adminClient
    .from('rooms')
    .select('id, number, floor, beds(id, label, is_active)')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (roomsErr || !rooms) {
    return { error: 'Błąd pobierania pokoi: ' + (roomsErr?.message || '') }
  }

  const rawRooms = (rooms as unknown as RoomRecord[]) || []
  const orgBedIds = rawRooms.flatMap((r) => (r.beds || []).map((b) => b.id))

  // Pobierz aktywne przypisania w tej placówce
  const { data: activeAssignments } = await adminClient
    .from('bed_assignments')
    .select('bed_id, resident_id, residents(gender)')
    .in('bed_id', orgBedIds.length > 0 ? orgBedIds : ['00000000-0000-0000-0000-000000000000'])
    .is('unassigned_at', null)

  const rawAssignments = (activeAssignments as unknown as ActiveAssignmentRecord[]) || []
  const occupiedBedIds = new Set(rawAssignments.map((a) => a.bed_id))

  const candidates: BedCandidate[] = []

  for (const room of rawRooms) {
    const roomBeds = room.beds || []
    const activeBeds = roomBeds.filter((b) => b.is_active)

    // Lokatorzy pokoju
    const roomOccupants = rawAssignments
      .filter((a) => roomBeds.some((b) => b.id === a.bed_id))
      .map((a) => ({ gender: a.residents?.gender || 'O' }))

    for (const bed of activeBeds) {
      if (!occupiedBedIds.has(bed.id)) {
        candidates.push({
          bedId: bed.id,
          bedNumber: bed.label,
          roomId: room.id,
          roomNumber: room.number,
          floorNumber: parseInt(room.floor || '0', 10) || 0,
          capacity: activeBeds.length,
          currentOccupants: roomOccupants,
        })
      }
    }
  }

  const suggestions = suggestBeds(candidates, { gender: residentGender, careLevel })
  return { suggestions }
}

export async function admitResidentAction(formData: FormData) {
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const idValue = formData.get('nationalId') as string
  const careLevelRaw = formData.get('careLevel') as string
  const careLevel = (careLevelRaw === 'sitting' || careLevelRaw === 'bedridden' || careLevelRaw === 'hospice') ? careLevelRaw : 'walking'
  const isZsn = formData.get('isZsn') === 'true'
  const bedId = (formData.get('bedId') as string) || null
  const notes = (formData.get('notes') as string) || null

  if (!firstName || !lastName || !idValue) {
    return { error: 'Imię, nazwisko oraz numer PESEL są wymagane.' }
  }

  const parsed = parseNationalId(idValue)
  if (!parsed.valid || !parsed.birthDate || !parsed.gender) {
    return { error: parsed.error || 'Nieprawidłowy numer PESEL.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Brak autoryzowanej sesji.' }

  const role = user.app_metadata?.role
  if (role !== 'org_admin' && role !== 'super_admin' && role !== 'admin') {
    return { error: 'Tylko administrator placówki może przyjmować pensjonariuszy.' }
  }

  const computedHash = hashNationalId(idValue)
  const computedEncrypted = encryptNationalId(idValue)

  const { data, error } = await supabase.rpc('admit_resident_with_bed', {
    p_first_name: firstName,
    p_last_name: lastName,
    p_pesel_hash: computedHash,
    p_pesel_encrypted: computedEncrypted,
    p_gender: parsed.gender,
    p_birth_date: parsed.birthDate,
    p_care_level: careLevel,
    p_is_zsn: isZsn,
    p_bed_id: bedId,
    p_notes: notes,
  })

  if (error) {
    if (error.message.includes('already occupied')) {
      return { error: 'Wybrane łóżko jest już zajęte przez innego pensjonariusza.' }
    }
    if (error.message.includes('already exists')) {
      return { error: 'Pensjonariusz o tym numerze PESEL jest już zarejestrowany w placówce.' }
    }
    return { error: 'Błąd przyjęcia pensjonariusza: ' + error.message }
  }

  revalidatePath('/admin/residents')
  revalidatePath('/admin/facility')

  const resData = data as { resident_id: string; bed_assignment_id: string | null } | null

  return {
    success: true,
    residentId: resData?.resident_id,
    bedAssignmentId: resData?.bed_assignment_id,
    message: `Pomyślnie przyjęto pensjonariusza ${firstName} ${lastName}${bedId ? ' i przypisano łóżko' : ''}.`,
  }
}
