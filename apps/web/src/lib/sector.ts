/**
 * Nazwa sektora tak, jak ją nazwano (np. „A”, „Skrzydło Północne”), bez przedrostka „Sektor”
 * (decyzja Michała 2026-10-26). Ta sama reguła co w migracji 20261026160000_rooms_sector_strip_prefix.
 */
const SECTOR_PREFIX = /^\s*sektor(?:\s*[:\-–]\s*|\s+|$)/i

/** Wartość do zapisu: bez przedrostka, przycięta; pusty sektor to null. */
export function normalizeSectorInput(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const value = String(raw).replace(SECTOR_PREFIX, '').trim()
  return value || null
}

/** Etykieta do wyświetlenia; brak sektora to „—”. */
export function formatSectorName(sector?: string | null): string {
  return normalizeSectorInput(sector) ?? '—'
}
