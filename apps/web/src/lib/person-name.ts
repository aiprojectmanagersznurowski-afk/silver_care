/**
 * Imię i nazwisko w formacie „Nazwisko Imię” (decyzja Michała 2026-10-26).
 * Brak obu części to jawne „Brak danych”, nie wymyślona wartość.
 */
export function formatPersonName(firstName?: string | null, lastName?: string | null): string {
  const name = [lastName, firstName].map((part) => (part || '').trim()).filter(Boolean).join(' ')
  return name || 'Brak danych'
}
