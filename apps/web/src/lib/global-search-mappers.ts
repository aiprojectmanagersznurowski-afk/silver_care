import {
  SearchResultItem,
  formatResidentSearchResult,
  formatFacilitySearchResult,
  formatAgendaSearchResult,
  formatReportSearchResult,
  rankSearchResults,
  normalizeForSearch,
  splitSearchWords,
} from './global-search-helpers'
import type {
  RawRoomWithBeds,
  RawBedWithRoom,
  RawResidentRow,
  RawAgendaRow,
  RawReportRow,
  RawOrgRow,
  RawSearchResultsPayload,
  GlobalSearchResponse,
} from './global-search-types'

export type { GlobalSearchResponse }

export function mapSearchQueryResults(
  payload: RawSearchResultsPayload,
  cleanQ: string,
  /** Rola z app_metadata — decyduje, dokąd prowadzą wyniki (karta personelu albo kierownika). */
  role?: string
): SearchResultItem[] {
  const results: SearchResultItem[] = []

  if (payload.resData) {
    const rows = payload.resData as RawResidentRow[]
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
          archived_at: r.archived_at,
          death_date: r.death_date,
          contract_end_date: r.contract_end_date,
          room_number: activeAssignment?.beds?.rooms?.number || null,
          bed_label: activeAssignment?.beds?.label || null,
        }, role)
      )
    }
  }

  const seenFacilityIds = new Set<string>()

  if (payload.roomsData) {
    const rows = payload.roomsData as RawRoomWithBeds[]
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
            }, role)
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
              resident_id: activeAssignment?.residents?.id ?? null,
            }, role)
          )
        }
      }
    }
  }

  if (payload.bedsData) {
    const rows = payload.bedsData as RawBedWithRoom[]
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
          resident_id: activeAssignment?.residents?.id ?? null,
        }, role)
      )
    }
  }

  if (payload.agendaData) {
    const rows = payload.agendaData as RawAgendaRow[]
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

  if (payload.reportsData) {
    const rows = payload.reportsData as RawReportRow[]
    for (const rep of rows) {
      const dateStr = rep.created_at ? rep.created_at.slice(0, 10) : ''
      const residentName = rep.residents
        ? `${rep.residents.first_name} ${rep.residents.last_name}`
        : null

      // Jak w zapytaniu do bazy: każde słowo frazy musi pasować do imienia lub nazwiska (kolejność dowolna)
      const nameText = normalizeForSearch(residentName ?? '')
      const nameMatches = Boolean(residentName) && splitSearchWords(cleanQ).every((w) => nameText.includes(normalizeForSearch(w)))
      const dateMatches = dateStr.includes(cleanQ)
      if (!nameMatches && !dateMatches) continue

      results.push(
        formatReportSearchResult({
          id: rep.id,
          report_date: dateStr,
          resident_name: residentName,
          resident_id: rep.residents?.id ?? null,
          status: rep.status,
        })
      )
    }
  }

  if (payload.orgsData) {
    const rows = payload.orgsData as RawOrgRow[]
    for (const org of rows) {
      results.push({
        id: org.id,
        title: org.name,
        subtitle: org.address || 'Placówka opiekuńcza',
        href: `/admin/organizations/${org.id}`,
        category: 'organizations',
        badge: 'Placówka',
        badgeVariant: 'outline',
      })
    }
  }

  return rankSearchResults(results, cleanQ)
}
