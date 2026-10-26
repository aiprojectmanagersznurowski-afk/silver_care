import { AGENDA_FAMILY_EXCLUSION } from '@silvercare/contracts/src/generated/presentation'

/**
 * @REQ: FAM-AGENDA-NO-MEDICAL
 *
 * Plan dnia rodziny bez treści medycznych (decyzja Michała 2026-10-26). Słowa z kontraktu; ta sama reguła
 * działa w bazie (public.is_medical_agenda_item → agenda_items.family_visible + RLS rodziny).
 * Słowo pasuje, gdy wyraz w tytule zaczyna się od rdzenia (przed nim początek tekstu albo znak niebędący literą).
 */
const TERMS = Object.values(AGENDA_FAMILY_EXCLUSION.termsByCategory).flat()

export const AGENDA_MEDICAL_PATTERN = `(^|[^a-ząćęłńóśźż0-9])(${TERMS.join('|')})`

const MEDICAL_RE = new RegExp(AGENDA_MEDICAL_PATTERN)
const EXCLUDED_TYPES = new Set<string>(AGENDA_FAMILY_EXCLUSION.excludedTypes)

export function isMedicalAgendaItem(item: { title?: string | null; type?: string | null }): boolean {
  if (item.type && EXCLUDED_TYPES.has(item.type.toLowerCase())) return true
  return MEDICAL_RE.test((item.title || '').toLowerCase())
}
