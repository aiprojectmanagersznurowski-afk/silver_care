import { describe, it, expect } from 'vitest'
import { BEDS_SELECT, mapBedsWithActiveAssignment } from '../../apps/web/src/lib/facility-beds-mapper'

/**
 * Widok łóżek (/admin/facility) renderuje BusinessIdBadge z bed.active_assignment.resident.id.
 * Gdy trasa nie zwraca id pensjonariusza, formatBusinessId robi undefined.replace(...) i cały
 * panel administracyjny kończy się błędem. Trasa nie może też wysyłać do przeglądarki pesel_hash.
 */
const RESIDENT = {
  id: 'res-1',
  first_name: 'Anna',
  last_name: 'Nowak',
  gender: 'F',
  is_zsn: true,
  care_level: 'high',
}

describe('API łóżek — dane pensjonariusza w przypisaniu (@REQ: ADM-FACILITY-OCCUPANCY, @REQ: SEC-PESEL-HASH)', () => {
  it('zapytanie pobiera id, płeć, ZSN i poziom opieki pensjonariusza @REQ: ADM-FACILITY-OCCUPANCY', () => {
    expect(BEDS_SELECT).toContain('residents(id, first_name, last_name, gender, is_zsn, care_level)')
  })

  it('zapytanie nie pobiera pesel_hash do przeglądarki @REQ: SEC-PESEL-HASH', () => {
    expect(BEDS_SELECT).not.toContain('pesel_hash')
  })

  it('aktywne przypisanie niesie resident_id i resident.id @REQ: ADM-FACILITY-OCCUPANCY', () => {
    const [bed] = mapBedsWithActiveAssignment([
      {
        id: 'bed-1', room_id: 'room-1', label: 'A', is_active: true, created_at: '2026-01-01',
        assignments: [
          { id: 'as-1', assigned_at: '2026-02-01', unassigned_at: null, resident_id: 'res-1', residents: RESIDENT },
        ],
      },
    ])
    expect(bed.active_assignment?.resident_id).toBe('res-1')
    expect(bed.active_assignment?.resident?.id).toBe('res-1')
    expect(bed.active_assignment?.resident?.gender).toBe('F')
  })

  it('uzupełnia resident.id z resident_id, gdy pensjonariusz nie ma id @REQ: ADM-FACILITY-OCCUPANCY', () => {
    const [bed] = mapBedsWithActiveAssignment([
      {
        id: 'bed-1', room_id: 'room-1', label: 'A', is_active: true, created_at: '2026-01-01',
        assignments: [
          { id: 'as-1', assigned_at: '2026-02-01', unassigned_at: null, resident_id: 'res-9',
            residents: { first_name: 'Jan', last_name: 'Kowalski' } },
        ],
      },
    ])
    expect(bed.active_assignment?.resident?.id).toBe('res-9')
  })

  it('obsługuje relację zwróconą jako tablica @REQ: ADM-FACILITY-OCCUPANCY', () => {
    const [bed] = mapBedsWithActiveAssignment([
      {
        id: 'bed-1', room_id: 'room-1', label: 'A', is_active: true, created_at: '2026-01-01',
        assignments: [
          { id: 'as-1', assigned_at: '2026-02-01', unassigned_at: null, resident_id: 'res-1', residents: [RESIDENT] },
        ],
      },
    ])
    expect(bed.active_assignment?.resident?.first_name).toBe('Anna')
  })

  it('pomija historyczne przypisania i zwraca null dla wolnego łóżka @REQ: ADM-FACILITY-OCCUPANCY', () => {
    const [free, history] = mapBedsWithActiveAssignment([
      { id: 'b1', room_id: 'r', label: 'A', is_active: true, created_at: 'x', assignments: [] },
      {
        id: 'b2', room_id: 'r', label: 'B', is_active: true, created_at: 'x',
        assignments: [
          { id: 'as-old', assigned_at: '2026-01-01', unassigned_at: '2026-01-31', resident_id: 'res-1', residents: RESIDENT },
        ],
      },
    ])
    expect(free.active_assignment).toBeNull()
    expect(history.active_assignment).toBeNull()
  })

  it('nigdy nie przekazuje pesel_hash dalej, nawet jeśli trafi do mapowania @REQ: SEC-PESEL-HASH', () => {
    const [bed] = mapBedsWithActiveAssignment([
      {
        id: 'bed-1', room_id: 'room-1', label: 'A', is_active: true, created_at: '2026-01-01',
        assignments: [
          { id: 'as-1', assigned_at: '2026-02-01', unassigned_at: null, resident_id: 'res-1',
            residents: { ...RESIDENT, pesel_hash: 'abc123' } },
        ],
      },
    ])
    expect(JSON.stringify(bed)).not.toContain('pesel_hash')
    expect(JSON.stringify(bed)).not.toContain('abc123')
  })
})
