import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { ResidentCardSection } from '@silvercare/contracts/src/generated/presentation'
import { resolveCardAccess, sectionsFor, residentSelect, type CardAccess } from './card-access'

type Row = Record<string, unknown>
type QueryResult = { data: unknown; error: { code?: string } | null }

export type ResidentCardResult =
  | { status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'error' }
  | {
      status: 'ok'
      access: CardAccess
      sections: ResidentCardSection[]
      resident: Row
      wearable: Row | null
      daily: { reports: Row[]; agenda: Row[] } | null
      /** Tabela wellness_daily nie istnieje jeszcze w bazie — jawny brak danych, nie zgadywanie. */
      wellness: { available: false }
    }

const failed = (r: QueryResult) => Boolean(r.error)

/**
 * Dane wspólnej karty podopiecznego (SC-ADM-20). Rola wyłącznie z app_metadata; odmowa przed zapytaniem.
 * Zasoby sekcji niedostępnych dla roli nie są odpytywane (obrona w głębi obok RLS); w logu tylko kody.
 */
export async function getResidentCard(
  supabase: SupabaseClient,
  residentId: string,
  user: User,
  isImpersonating: boolean
): Promise<ResidentCardResult> {
  const access = resolveCardAccess(user.app_metadata?.role as string | undefined, isImpersonating)
  if (!access) return { status: 'forbidden' }
  const sections = sectionsFor(access)
  const orgId = user.app_metadata?.organization_id as string | undefined

  let residentQuery = supabase.from('residents').select(residentSelect(sections)).eq('id', residentId)
  if (orgId) residentQuery = residentQuery.eq('organization_id', orgId)

  const [resident, wearable, reports, agenda] = (await Promise.all([
    residentQuery.maybeSingle(),
    sections.includes('wearable')
      ? supabase.from('external_wearable_links').select('id, provider, external_user_id, created_at').eq('resident_id', residentId).eq('provider', 'POLAR').maybeSingle()
      : { data: null, error: null },
    sections.includes('daily')
      ? supabase.from('daily_reports').select('id, status, created_at, approved_at').eq('resident_id', residentId).order('created_at', { ascending: false }).limit(5)
      : { data: [], error: null },
    sections.includes('daily')
      ? supabase.from('agenda_items').select('id, title, time, type, target_date').eq('resident_id', residentId).order('target_date', { ascending: false }).limit(5)
      : { data: [], error: null },
  ])) as QueryResult[]

  if ([resident, wearable, reports, agenda].some(failed)) {
    const codes = [resident, wearable, reports, agenda].flatMap((r) => (r.error?.code ? [r.error.code] : []))
    console.error('[karta-podopiecznego] błąd zapytania', { codes })
    return { status: 'error' }
  }
  if (!resident.data) return { status: 'not_found' }

  return {
    status: 'ok',
    access,
    sections,
    resident: resident.data as Row,
    wearable: (wearable.data as Row | null) ?? null,
    daily: sections.includes('daily') ? { reports: (reports.data as Row[]) ?? [], agenda: (agenda.data as Row[]) ?? [] } : null,
    wellness: { available: false },
  }
}
