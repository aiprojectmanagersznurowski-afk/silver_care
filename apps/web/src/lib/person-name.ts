/**
 * Imię i nazwisko w formacie „Nazwisko Imię” (decyzja Michała 2026-10-26).
 * Brak obu części to jawne „Brak danych”, nie wymyślona wartość.
 */
export function formatPersonName(firstName?: string | null, lastName?: string | null): string {
  const name = [lastName, firstName].map((part) => (part || '').trim()).filter(Boolean).join(' ')
  return name || 'Brak danych'
}

type NamedPerson = { first_name?: string | null; last_name?: string | null }

const collator = new Intl.Collator('pl', { sensitivity: 'base' })

/** Fraza pasuje do osoby niezależnie od kolejności imienia i nazwiska. */
export function matchesPersonName(firstName: string | null | undefined, lastName: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const first = (firstName || '').trim().toLowerCase()
  const last = (lastName || '').trim().toLowerCase()
  return `${last} ${first}`.includes(q) || `${first} ${last}`.includes(q)
}

/** Porównanie po nazwisku, potem po imieniu, z polskim alfabetem. */
export function compareByPersonName(a: NamedPerson, b: NamedPerson): number {
  return collator.compare(a.last_name || '', b.last_name || '') || collator.compare(a.first_name || '', b.first_name || '')
}

/** Nowa tablica ułożona po nazwisku i imieniu; wejście bez zmian. */
export function sortByPersonName<T extends NamedPerson>(people: readonly T[]): T[] {
  return [...people].sort(compareByPersonName)
}
