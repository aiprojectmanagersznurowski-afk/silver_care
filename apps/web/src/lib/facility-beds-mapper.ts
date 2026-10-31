/**
 * Zapytanie i mapowanie łóżek z aktywnym przypisaniem (GET /api/facility/beds).
 *
 * Widok łóżek renderuje BusinessIdBadge z bed.active_assignment.resident.id, więc trasa musi
 * zwracać id podopiecznego (bez niego formatBusinessId robi undefined.replace i panel się
 * wywraca). Do przeglądarki trafiają wyłącznie pola potrzebne widokowi — bez pesel_hash.
 *
 * @REQ: ADM-FACILITY-OCCUPANCY
 * @REQ: SEC-PESEL-HASH
 */

/** Zapytanie musi być literałem: klient Supabase wyprowadza z niego typ wiersza. */
export const BEDS_SELECT = `
      id, room_id, label, is_active, created_at,
      assignments:bed_assignments(id, assigned_at, unassigned_at, resident_id, residents(id, first_name, last_name, gender, is_zsn, care_level))
    ` as const

interface RawResident {
  id?: string | null
  first_name: string
  last_name: string
  gender?: string | null
  is_zsn?: boolean | null
  care_level?: string | null
}

interface RawAssignment {
  id: string
  assigned_at: string
  unassigned_at: string | null
  resident_id: string
  residents: RawResident | RawResident[] | null
}

export interface RawBed {
  id: string
  room_id: string
  label: string
  is_active: boolean
  created_at: string
  assignments?: RawAssignment[] | null
}

function pickResident(resident: RawResident, residentId: string) {
  return {
    id: resident.id ?? residentId,
    first_name: resident.first_name,
    last_name: resident.last_name,
    gender: resident.gender ?? undefined,
    is_zsn: resident.is_zsn ?? undefined,
    care_level: resident.care_level ?? undefined,
  }
}

/** Zostawia tylko aktywne przypisanie (bez zwolnionych) i whitelistuje pola podopiecznego. */
export function mapBedsWithActiveAssignment(beds: RawBed[]) {
  return beds.map((bed) => {
    const active = bed.assignments?.find((a) => !a.unassigned_at)
    const resident = active
      ? Array.isArray(active.residents)
        ? active.residents[0]
        : active.residents
      : null
    return {
      id: bed.id,
      room_id: bed.room_id,
      label: bed.label,
      is_active: bed.is_active,
      created_at: bed.created_at,
      active_assignment: active
        ? {
            id: active.id,
            assigned_at: active.assigned_at,
            resident_id: active.resident_id,
            resident: resident ? pickResident(resident, active.resident_id) : null,
          }
        : null,
    }
  })
}
