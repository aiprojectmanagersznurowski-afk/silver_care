import { describe, it, expect } from 'vitest'
import {
  ADMIN_RESIDENT_LIST_COLUMNS,
  ADMIN_RESIDENT_LIST_SELECT,
} from '../../apps/web/src/lib/admin-resident-columns'

/**
 * Lista podopiecznych w /admin/residents trafia do komponentów klienckich
 * (AdminResidentsClient, ResidentEditSheet, ResidentMobileCard), więc każda
 * pobrana kolumna ląduje w przeglądarce. Pobieramy wyłącznie pola, które te
 * komponenty wyświetlają albo edytują.
 */
describe('Admin residents list — minimalizacja danych w warstwie klienta', () => {
  it('nie pobiera pesel_hash ani kolumn spoza widoku listy @REQ: SEC-PESEL-HASH', () => {
    const forbidden = [
      'pesel_hash',
      'organization_id',
      'gender',
      'contract_start_date',
      'contract_source',
      'contract_monthly_rate',
      'contract_document_path',
      'contract_document_name',
    ]
    for (const col of forbidden) {
      expect(ADMIN_RESIDENT_LIST_COLUMNS).not.toContain(col)
    }
  })

  it('nie używa select("*") @REQ: SEC-PESEL-HASH', () => {
    expect(ADMIN_RESIDENT_LIST_SELECT).not.toMatch(/(^|[\s,(])\*/)
  })

  it('zachowuje pola wymagane przez kafelki, tabelę i arkusz edycji @REQ: SEC-PESEL-HASH', () => {
    const required = [
      'id',
      'first_name',
      'last_name',
      'avatar_url',
      'care_level',
      'is_zsn',
      'archived_at',
      'death_date',
      'admission_date',
      'birth_date',
      'notes',
      'contract_end_date',
      'contract_end_reason',
      'created_at',
    ]
    for (const col of required) {
      expect(ADMIN_RESIDENT_LIST_COLUMNS).toContain(col)
    }
    expect(ADMIN_RESIDENT_LIST_SELECT).toContain(
      'bed_assignments(id, unassigned_at, beds(id, label, rooms(number)))'
    )
  })
})
