'use server'

import { createClient } from '@/lib/supabase/server'
import {
  SearchCategoryKey,
  sanitizeSearchQuery,
  filterSearchResultsByCategory,
} from '@/lib/global-search-helpers'
import {
  mapSearchQueryResults,
  type GlobalSearchResponse,
} from '@/lib/global-search-mappers'

export async function searchGlobalAction(
  rawQuery: string,
  selectedCategory: SearchCategoryKey | 'all' = 'all'
): Promise<GlobalSearchResponse> {
  const cleanQ = sanitizeSearchQuery(rawQuery)
  if (!cleanQ || cleanQ.length < 2) {
    return {
      success: true,
      query: cleanQ,
      items: [],
      totalCount: 0,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      query: cleanQ,
      items: [],
      totalCount: 0,
      error: 'Brak autoryzacji.',
    }
  }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  const isSuperAdmin = role === 'super_admin'

  try {
    // 1. Wyszukiwanie pensjonariuszy (residents)
    let residentQuery = supabase
      .from('residents')
      .select('id, first_name, last_name, care_level, is_zsn, bed_assignments(unassigned_at, beds(label, rooms(number)))')
      .is('archived_at', null)
      .or(`first_name.ilike.%${cleanQ}%,last_name.ilike.%${cleanQ}%`)
      .limit(6)

    if (!isSuperAdmin && orgId) {
      residentQuery = residentQuery.eq('organization_id', orgId)
    }

    // 2. Wyszukiwanie pokoi i łóżek (facility)
    let roomsQuery = supabase
      .from('rooms')
      .select('id, number, floor, sector, organization_id, beds(id, label, bed_assignments(unassigned_at, residents(first_name, last_name)))')
      .or(`number.ilike.%${cleanQ}%,sector.ilike.%${cleanQ}%`)
      .limit(6)

    if (!isSuperAdmin && orgId) {
      roomsQuery = roomsQuery.eq('organization_id', orgId)
    }

    let bedsQuery = supabase
      .from('beds')
      .select('id, label, rooms!inner(id, number, floor, sector, organization_id), bed_assignments(unassigned_at, residents(first_name, last_name))')
      .ilike('label', `%${cleanQ}%`)
      .limit(6)

    if (!isSuperAdmin && orgId) {
      bedsQuery = bedsQuery.eq('rooms.organization_id', orgId)
    }

    // 3. Wyszukiwanie planu dnia (agenda)
    let agendaQuery = supabase
      .from('agenda_items')
      .select('id, title, time, residents(first_name, last_name)')
      .ilike('title', `%${cleanQ}%`)
      .limit(6)

    if (!isSuperAdmin && orgId) {
      agendaQuery = agendaQuery.eq('organization_id', orgId)
    }

    // 4. Wyszukiwanie raportów dobowych (reports)
    const isDateSearch = /^\d{4}/.test(cleanQ) || /^\d{2}-\d{2}/.test(cleanQ)
    let reportsQuery = supabase
      .from('daily_reports')
      .select('id, created_at, status, residents!inner(first_name, last_name, organization_id)')
      .limit(6)

    if (!isSuperAdmin && orgId) {
      reportsQuery = reportsQuery.eq('residents.organization_id', orgId)
    }

    if (isDateSearch) {
      reportsQuery = reportsQuery.gte('created_at', `${cleanQ}T00:00:00Z`).lte('created_at', `${cleanQ}T23:59:59Z`)
    } else {
      reportsQuery = reportsQuery.or(`first_name.ilike.%${cleanQ}%,last_name.ilike.%${cleanQ}%`, { foreignTable: 'residents' })
    }

    // 5. Wyszukiwanie placówek (tylko dla super_admin)
    const orgsPromise = isSuperAdmin
      ? supabase
          .from('organizations')
          .select('id, name, city')
          .ilike('name', `%${cleanQ}%`)
          .limit(6)
      : Promise.resolve({ data: [] })

    const [resResult, roomsResult, bedsResult, agendaResult, reportsResult, orgsResult] =
      await Promise.allSettled([
        residentQuery,
        roomsQuery,
        bedsQuery,
        agendaQuery,
        reportsQuery,
        orgsPromise,
      ])

    const results = mapSearchQueryResults(
      {
        resData: resResult.status === 'fulfilled' ? resResult.value.data : undefined,
        roomsData: roomsResult.status === 'fulfilled' ? roomsResult.value.data : undefined,
        bedsData: bedsResult.status === 'fulfilled' ? bedsResult.value.data : undefined,
        agendaData: agendaResult.status === 'fulfilled' ? agendaResult.value.data : undefined,
        reportsData: reportsResult.status === 'fulfilled' ? reportsResult.value.data : undefined,
        orgsData: orgsResult.status === 'fulfilled' ? (orgsResult.value as { data: unknown })?.data : undefined,
      },
      cleanQ
    )

    const filtered = filterSearchResultsByCategory(results, selectedCategory)

    return {
      success: true,
      query: cleanQ,
      items: filtered,
      totalCount: filtered.length,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Wystąpił błąd podczas wyszukiwania.'
    return {
      success: false,
      query: cleanQ,
      items: [],
      totalCount: 0,
      error: errorMsg,
    }
  }
}
