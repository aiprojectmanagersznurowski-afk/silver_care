import { RESIDENT_CARD_SECTIONS, type ResidentCardSection } from '@silvercare/contracts/src/generated/presentation'

export type CardRole = 'org_admin' | 'nurse'

export interface CardAccess {
  role: CardRole
  /** Superadmin w impersonacji widzi kartę kierownika bez sekcji zapisu. */
  readOnly: boolean
}

/** Rola karty wyłącznie z app_metadata; poza personelem z kontraktu — brak karty (null). */
export function resolveCardAccess(role: string | undefined, isImpersonating: boolean): CardAccess | null {
  if (role === 'org_admin' || role === 'nurse') return { role, readOnly: false }
  if (role === 'super_admin' && isImpersonating) return { role: 'org_admin', readOnly: true }
  return null
}

/** Sekcje karty dla roli, w kolejności z kontraktu (RESIDENT_CARD_SECTIONS). */
export function sectionsFor(access: CardAccess): ResidentCardSection[] {
  return RESIDENT_CARD_SECTIONS.filter((s) => (s.roles as readonly string[]).includes(access.role))
    .filter((s) => !(access.readOnly && 'access' in s && s.access === 'update'))
    .map((s) => s.id)
}

/** Kolumny przeglądu: wszystko, czego potrzebuje nagłówek i dane ogólne — bez pesel_hash. */
const OVERVIEW_COLUMNS = [
  'id', 'first_name', 'last_name', 'birth_date', 'gender', 'admission_date', 'care_level', 'is_zsn',
  'avatar_url', 'notes', 'archived_at', 'death_date', 'death_reported_at', 'contract_end_date',
]

/** Kolumny umowy (opłaty i dokument) — wyłącznie w sekcji „Umowa i pakiety”. */
const CONTRACT_COLUMNS = [
  'contract_start_date', 'contract_end_reason', 'contract_source', 'contract_monthly_rate',
  'contract_document_path', 'contract_document_name',
]

const RELATIONS: Partial<Record<ResidentCardSection, string>> = {
  bed: 'bed_assignments(id, assigned_at, unassigned_at, beds(id, label, rooms(number, floor, sector)))',
  family: 'resident_relative_links(id, relative_user_id, relationship_code, role, is_primary_contact, created_at)',
  contract: 'resident_packages(id, package_type, package_name, monthly_rate, started_at, ended_at)',
  events: 'resident_events(id, event_type, event_date, event_reason, metadata, created_at)',
}

/** Jawny wybór kolumn i relacji dla sekcji roli — nigdy „*”. */
export function residentSelect(sections: ResidentCardSection[]): string {
  const columns = [...OVERVIEW_COLUMNS, ...(sections.includes('contract') ? CONTRACT_COLUMNS : [])]
  const relations = sections.flatMap((s) => (RELATIONS[s] ? [RELATIONS[s] as string] : []))
  return [...columns, ...relations].join(', ')
}
