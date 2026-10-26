'use server'

import { createClient } from '@/lib/supabase/server'
import {
  SearchCategoryKey,
  sanitizeSearchQuery,
  filterSearchResultsByCategory,
  isStaffRole,
  categoriesToSearch,
  splitSearchWords,
} from '@/lib/global-search-helpers'
import {
  mapSearchQueryResults,
  type GlobalSearchResponse,
} from '@/lib/global-search-mappers'

type QueryResult = { data: unknown[] | null; error: { code?: string } | null }

const NONE: QueryResult = { data: [], error: null }

function failure(query: string, error: string): GlobalSearchResponse {
  return { success: false, query, items: [], totalCount: 0, error }
}

export async function searchGlobalAction(
  rawQuery: string,
  selectedCategory: SearchCategoryKey | 'all' = 'all'
): Promise<GlobalSearchResponse> {
  const cleanQ = sanitizeSearchQuery(rawQuery)
  if (!cleanQ || cleanQ.length < 2) {
    return { success: true, query: cleanQ, items: [], totalCount: 0 }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return failure(cleanQ, 'Brak autoryzacji.')

  // Rola wyłącznie z app_metadata (user_metadata edytuje sam użytkownik); fail-closed poza personelem z kontraktu
  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  const isSuperAdmin = role === 'super_admin'
  if (!isStaffRole(role) || (!isSuperAdmin && !orgId)) {
    return failure(cleanQ, 'Brak uprawnień do wyszukiwarki.')
  }

  const org = orgId as string
  const want = new Set(categoriesToSearch(selectedCategory, role))
  const like = `%${cleanQ}%`
  const words = splitSearchWords(cleanQ)
  // Każde słowo musi pasować do imienia albo nazwiska (osobne .or() są łączone warunkiem „i”)
  const nameFilter = (w: string) => `first_name.ilike.%${w}%,last_name.ilike.%${w}%`

  // Odpytujemy tylko wybrane kategorie; poza super_admin każde zapytanie jest zawężone do organizacji z tokenu
  const residents = () => {
    let q = supabase
      .from('residents')
      .select('id, first_name, last_name, care_level, is_zsn, archived_at, death_date, contract_end_date, bed_assignments(unassigned_at, beds(label, rooms(number)))')
    for (const w of words) q = q.or(nameFilter(w))
    const ordered = q
      .order('archived_at', { ascending: true, nullsFirst: true }) // aktywni przed archiwalnymi, zanim zadziała limit
      .limit(6)
    return isSuperAdmin ? ordered : ordered.eq('organization_id', org)
  }

  const rooms = () => {
    const q = supabase
      .from('rooms')
      .select('id, number, floor, sector, organization_id, beds(id, label, bed_assignments(unassigned_at, residents(first_name, last_name)))')
      .or(`number.ilike.${like},sector.ilike.${like}`)
      .limit(6)
    return isSuperAdmin ? q : q.eq('organization_id', org)
  }

  const beds = () => {
    const q = supabase
      .from('beds')
      .select('id, label, rooms!inner(id, number, floor, sector, organization_id), bed_assignments(unassigned_at, residents(first_name, last_name))')
      .ilike('label', like)
      .limit(6)
    return isSuperAdmin ? q : q.eq('rooms.organization_id', org)
  }

  const agenda = () => {
    const q = supabase
      .from('agenda_items')
      .select('id, title, time, residents(first_name, last_name)')
      .ilike('title', like)
      .limit(6)
    return isSuperAdmin ? q : q.eq('organization_id', org)
  }

  const reports = () => {
    // Zakres dat tylko dla pełnej daty; samo „2026” albo „10-24” to zwykły tekst (inaczej powstaje niepoprawny znacznik czasu)
    const isDateSearch = /^\d{4}-\d{2}-\d{2}$/.test(cleanQ)
    let q = supabase
      .from('daily_reports')
      .select('id, created_at, status, residents!inner(first_name, last_name, organization_id)')
      .limit(6)
    if (!isSuperAdmin) q = q.eq('residents.organization_id', org)
    if (isDateSearch) return q.gte('created_at', `${cleanQ}T00:00:00Z`).lte('created_at', `${cleanQ}T23:59:59Z`)
    for (const w of words) q = q.or(nameFilter(w), { foreignTable: 'residents' })
    return q
  }

  const organizations = () => supabase.from('organizations').select('id, name, address').ilike('name', like).limit(6)

  try {
    const settled = (await Promise.allSettled([
      want.has('residents') ? residents() : NONE,
      want.has('facility') ? rooms() : NONE,
      want.has('facility') ? beds() : NONE,
      want.has('agenda') ? agenda() : NONE,
      want.has('reports') ? reports() : NONE,
      want.has('organizations') ? organizations() : NONE,
    ])) as PromiseSettledResult<QueryResult>[]

    // Błąd któregokolwiek zapytania to jawny błąd, a nie lista bez tej grupy; w logu tylko kody techniczne
    const failed = settled.some((s) => s.status === 'rejected' || s.value.error)
    if (failed) {
      const codes = settled.flatMap((s) => (s.status === 'fulfilled' && s.value.error?.code ? [s.value.error.code] : []))
      console.error('[global-search] błąd zapytania', { codes, rejected: settled.filter((s) => s.status === 'rejected').length })
      return failure(cleanQ, 'Nie udało się wyszukać. Spróbuj ponownie.')
    }

    const [resData, roomsData, bedsData, agendaData, reportsData, orgsData] = settled.map((s) =>
      s.status === 'fulfilled' ? (s.value.data ?? undefined) : undefined
    )
    const results = mapSearchQueryResults({ resData, roomsData, bedsData, agendaData, reportsData, orgsData }, cleanQ)
    const filtered = filterSearchResultsByCategory(results, selectedCategory)

    return { success: true, query: cleanQ, items: filtered, totalCount: filtered.length }
  } catch {
    return failure(cleanQ, 'Nie udało się wyszukać. Spróbuj ponownie.')
  }
}
