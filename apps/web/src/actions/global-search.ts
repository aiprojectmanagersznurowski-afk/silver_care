'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  SearchCategoryKey,
  SearchResultItem,
  sanitizeSearchQuery,
  formatResidentSearchResult,
  formatFacilitySearchResult,
  formatAgendaSearchResult,
  formatReportSearchResult,
  filterSearchResultsByCategory,
} from '@/lib/global-search-helpers'

export interface GlobalSearchResponse {
  success: boolean
  query: string
  items: SearchResultItem[]
  totalCount: number
  error?: string
}

interface RawRoomWithBeds {
  id: string
  number: string
  floor: number | null
  sector: string | null
  organization_id: string
  beds: Array<{
    id: string
    label: string
    bed_assignments: Array<{
      unassigned_at: string | null
      residents: {
        first_name: string
        last_name: string
      } | null
    }> | null
  }> | null
}

interface RawBedWithRoom {
  id: string
  label: string
  rooms: {
    id: string
    number: string
    floor: number | null
    sector: string | null
    organization_id: string
  } | null
  bed_assignments: Array<{
    unassigned_at: string | null
    residents: {
      first_name: string
      last_name: string
    } | null
  }> | null
}

interface RawResidentRow {
  id: string
  first_name: string
  last_name: string
  care_level: string | null
  is_zsn: boolean | null
  bed_assignments: Array<{
    unassigned_at: string | null
    beds: {
      label: string
      rooms: {
        number: string
      } | null
    } | null
  }> | null
}

interface RawAgendaRow {
  id: string
  title: string
  time: string
  residents: {
    first_name: string
    last_name: string
  } | null
}

interface RawReportRow {
  id: string
  created_at: string | null
  status: string
  residents: {
    first_name: string
    last_name: string
  } | null
}

interface RawOrgRow {
  id: string
  name: string
  city: string | null
}

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

  const results: SearchResultItem[] = []

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

    // Formatowanie: Podopieczni
    if (resResult.status === 'fulfilled' && resResult.value.data) {
      const rows = resResult.value.data as unknown as RawResidentRow[]
      for (const r of rows) {
        const activeAssignment = Array.isArray(r.bed_assignments)
          ? r.bed_assignments.find((a) => a.unassigned_at === null)
          : null

        results.push(
          formatResidentSearchResult({
            id: r.id,
            first_name: r.first_name,
            last_name: r.last_name,
            care_level: r.care_level,
            is_zsn: r.is_zsn,
            room_number: activeAssignment?.beds?.rooms?.number || null,
            bed_label: activeAssignment?.beds?.label || null,
          })
        )
      }
    }

    // Formatowanie: Pokoje i łóżka
    const seenFacilityIds = new Set<string>()

    if (roomsResult.status === 'fulfilled' && roomsResult.value.data) {
      const rows = roomsResult.value.data as unknown as RawRoomWithBeds[]
      for (const r of rows) {
        const bedsList = Array.isArray(r.beds) ? r.beds : []
        if (bedsList.length === 0) {
          if (!seenFacilityIds.has(r.id)) {
            seenFacilityIds.add(r.id)
            results.push(
              formatFacilitySearchResult({
                id: r.id,
                room_id: r.id,
                room_number: r.number,
                floor: r.floor,
                sector: r.sector,
                bed_label: null,
                resident_name: null,
              })
            )
          }
        } else {
          for (const b of bedsList) {
            if (seenFacilityIds.has(b.id)) continue
            seenFacilityIds.add(b.id)

            const activeAssignment = Array.isArray(b.bed_assignments)
              ? b.bed_assignments.find((a) => a.unassigned_at === null)
              : null

            const residentName = activeAssignment?.residents
              ? `${activeAssignment.residents.first_name} ${activeAssignment.residents.last_name}`
              : null

            results.push(
              formatFacilitySearchResult({
                id: b.id,
                room_id: r.id,
                room_number: r.number,
                floor: r.floor,
                sector: r.sector,
                bed_label: b.label,
                resident_name: residentName,
              })
            )
          }
        }
      }
    }

    if (bedsResult.status === 'fulfilled' && bedsResult.value.data) {
      const rows = bedsResult.value.data as unknown as RawBedWithRoom[]
      for (const b of rows) {
        if (!b.rooms || seenFacilityIds.has(b.id)) continue
        seenFacilityIds.add(b.id)

        const activeAssignment = Array.isArray(b.bed_assignments)
          ? b.bed_assignments.find((a) => a.unassigned_at === null)
          : null

        const residentName = activeAssignment?.residents
          ? `${activeAssignment.residents.first_name} ${activeAssignment.residents.last_name}`
          : null

        results.push(
          formatFacilitySearchResult({
            id: b.id,
            room_id: b.rooms.id,
            room_number: b.rooms.number,
            floor: b.rooms.floor,
            sector: b.rooms.sector,
            bed_label: b.label,
            resident_name: residentName,
          })
        )
      }
    }

    // Formatowanie: Plan dnia
    if (agendaResult.status === 'fulfilled' && agendaResult.value.data) {
      const rows = agendaResult.value.data as unknown as RawAgendaRow[]
      for (const a of rows) {
        const residentName = a.residents
          ? `${a.residents.first_name} ${a.residents.last_name}`
          : null

        results.push(
          formatAgendaSearchResult({
            id: a.id,
            title: a.title,
            scheduled_time: a.time,
            resident_name: residentName,
          })
        )
      }
    }

    // Formatowanie: Raporty dobowe
    if (reportsResult.status === 'fulfilled' && reportsResult.value.data) {
      const rows = reportsResult.value.data as unknown as RawReportRow[]
      for (const rep of rows) {
        const dateStr = rep.created_at ? rep.created_at.slice(0, 10) : ''
        const residentName = rep.residents
          ? `${rep.residents.first_name} ${rep.residents.last_name}`
          : null

        // Weryfikacja dopasowania w wynikach
        const nameMatches = residentName?.toLowerCase().includes(cleanQ.toLowerCase())
        const dateMatches = dateStr.includes(cleanQ)
        if (!nameMatches && !dateMatches) continue

        results.push(
          formatReportSearchResult({
            id: rep.id,
            report_date: dateStr,
            resident_name: residentName,
            status: rep.status,
          })
        )
      }
    }

    // Formatowanie: Placówki (super_admin)
    if (orgsResult.status === 'fulfilled' && orgsResult.value?.data) {
      const rows = orgsResult.value.data as unknown as RawOrgRow[]
      for (const org of rows) {
        results.push({
          id: org.id,
          title: org.name,
          subtitle: org.city ? `Miasto: ${org.city}` : 'Placówka opiekuńcza',
          href: `/admin/organizations/${org.id}`,
          category: 'organizations',
          badge: 'Placówka',
          badgeVariant: 'outline',
        })
      }
    }

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
