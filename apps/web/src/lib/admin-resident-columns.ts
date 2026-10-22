/**
 * Kolumny listy podopiecznych w /admin/residents.
 *
 * Wiersze trafiają do komponentów klienckich (AdminResidentsClient, ResidentEditSheet,
 * ResidentMobileCard), więc każda pobrana kolumna ląduje w przeglądarce. Zapytanie obejmuje
 * wyłącznie pola wyświetlane albo edytowane w tym widoku — bez pesel_hash i danych umowy.
 *
 * Zapytanie musi być literałem: klient Supabase wyprowadza z niego typ wiersza.
 */
export const ADMIN_RESIDENT_LIST_SELECT =
  'id, first_name, last_name, avatar_url, care_level, is_zsn, archived_at, death_date, admission_date, birth_date, notes, contract_end_date, contract_end_reason, created_at, bed_assignments(id, unassigned_at, beds(id, label, rooms(number)))' as const

/** Kolumny najwyższego poziomu wyprowadzone z zapytania (bez zagnieżdżonych relacji). */
export const ADMIN_RESIDENT_LIST_COLUMNS: readonly string[] = splitTopLevel(ADMIN_RESIDENT_LIST_SELECT)
  .filter((part) => !part.includes('('))

function splitTopLevel(select: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of select) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}
