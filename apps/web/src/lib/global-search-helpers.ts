export type SearchCategoryKey =
  | 'residents'
  | 'facility'
  | 'agenda'
  | 'reports'
  | 'staff'
  | 'organizations'

export interface SearchCategoryMeta {
  key: SearchCategoryKey
  label: string
  description: string
  superAdminOnly?: boolean
}

export const SEARCH_CATEGORIES: Record<SearchCategoryKey, SearchCategoryMeta> = {
  residents: {
    key: 'residents',
    label: 'Podopieczni',
    description: 'Pensjonariusze placówki, pokoje, łóżka i statusy',
  },
  facility: {
    key: 'facility',
    label: 'Pokoje i łóżka',
    description: 'Pokoje, piętra, sektory oraz miejsca',
  },
  agenda: {
    key: 'agenda',
    label: 'Plan dnia',
    description: 'Zadania opiekuńcze i harmonogram',
  },
  reports: {
    key: 'reports',
    label: 'Raporty',
    description: 'Zatwierdzone raporty dobowe',
  },
  staff: {
    key: 'staff',
    label: 'Personel',
    description: 'Konta personelu i opiekunów prawnych',
  },
  organizations: {
    key: 'organizations',
    label: 'Placówki',
    description: 'Domy opieki i ośrodki w systemie',
    superAdminOnly: true,
  },
}

export interface SearchResultItem {
  id: string
  title: string
  subtitle: string
  href: string
  category: SearchCategoryKey
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/--+/g, '') // Usuń sekwencje komentarzy SQL
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Zachowaj tylko litery Unicode, cyfry, spacje i pojedyncze myślniki
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCategoryAvailableForRole(
  category: SearchCategoryKey,
  role?: string | null
): boolean {
  if (category === 'organizations') {
    return role === 'super_admin'
  }
  return true
}

export function formatResidentSearchResult(resident: {
  id: string
  first_name: string
  last_name: string
  room_number?: string | null
  bed_label?: string | null
  care_level?: string | null
  is_zsn?: boolean | null
}): SearchResultItem {
  const roomBedStr =
    resident.room_number && resident.bed_label
      ? `Pokój ${resident.room_number}, łóżko ${resident.bed_label}`
      : resident.room_number
      ? `Pokój ${resident.room_number}`
      : 'Brak przypisanego łóżka'

  let badge: string | undefined
  if (resident.is_zsn) {
    badge = 'ZSN'
  }

  return {
    id: resident.id,
    title: `${resident.first_name} ${resident.last_name}`,
    subtitle: roomBedStr,
    href: `/admin/residents/${resident.id}`,
    category: 'residents',
    badge,
    badgeVariant: badge ? 'secondary' : undefined,
  }
}

export function formatFacilitySearchResult(roomBed: {
  id: string
  room_id: string
  room_number: string
  floor?: number | null
  sector?: string | null
  bed_label?: string | null
  resident_name?: string | null
}): SearchResultItem {
  const title = roomBed.bed_label
    ? `Pokój ${roomBed.room_number}, łóżko ${roomBed.bed_label}`
    : `Pokój ${roomBed.room_number}`

  const floorSector = [
    roomBed.floor !== null && roomBed.floor !== undefined ? `Piętro ${roomBed.floor}` : null,
    roomBed.sector ? `Sektor ${roomBed.sector}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const subtitle = roomBed.resident_name
    ? `${floorSector ? `${floorSector} • ` : ''}${roomBed.resident_name}`
    : floorSector || 'Wolne miejsce'

  return {
    id: roomBed.id,
    title,
    subtitle,
    href: `/admin/facility`,
    category: 'facility',
    badge: roomBed.resident_name ? 'Zajęte' : 'Wolne',
    badgeVariant: roomBed.resident_name ? 'default' : 'outline',
  }
}

export function formatAgendaSearchResult(agenda: {
  id: string
  title: string
  scheduled_time?: string | null
  resident_name?: string | null
}): SearchResultItem {
  const parts: string[] = []
  if (agenda.scheduled_time) {
    parts.push(agenda.scheduled_time)
  }
  if (agenda.resident_name) {
    parts.push(agenda.resident_name)
  }

  return {
    id: agenda.id,
    title: agenda.title,
    subtitle: parts.join(' • ') || 'Zadanie z planu dnia',
    href: `/agenda`,
    category: 'agenda',
  }
}

export function formatReportSearchResult(report: {
  id: string
  report_date: string
  resident_name?: string | null
  status?: string | null
}): SearchResultItem {
  return {
    id: report.id,
    title: `Raport z dnia ${report.report_date}`,
    subtitle: report.resident_name ? `Podopieczny: ${report.resident_name}` : 'Raport dobowy',
    href: `/reports`,
    category: 'reports',
    badge: report.status === 'approved' ? 'Zatwierdzony' : 'Wersja robocza',
    badgeVariant: report.status === 'approved' ? 'default' : 'outline',
  }
}

export function filterSearchResultsByCategory(
  items: SearchResultItem[],
  selectedCategory: SearchCategoryKey | 'all'
): SearchResultItem[] {
  if (selectedCategory === 'all') {
    return items
  }
  return items.filter((item) => item.category === selectedCategory)
}
