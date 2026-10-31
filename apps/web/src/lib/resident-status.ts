export type ResidentStatusKind = 'archived' | 'deceased' | 'discharged' | 'active'

interface ResidentStatusFields {
  archived_at?: string | null
  death_date?: string | null
  contract_end_date?: string | null
}

const LABELS: Record<ResidentStatusKind, string> = {
  archived: 'Zarchiwizowany',
  deceased: 'Zgon',
  discharged: 'Wypisany',
  active: 'Aktywny',
}

/** Jeden status podopiecznego dla tabeli, kafelków i karty mobilnej (ADR-017). Fakt, nie ocena. */
export function getResidentStatus(resident: ResidentStatusFields, now: Date = new Date()) {
  const kind: ResidentStatusKind = resident.archived_at
    ? 'archived'
    : resident.death_date
      ? 'deceased'
      : resident.contract_end_date && new Date(resident.contract_end_date) <= now
        ? 'discharged'
        : 'active'
  return { kind, label: LABELS[kind] }
}
