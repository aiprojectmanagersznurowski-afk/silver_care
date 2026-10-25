import { STAFF_ROLES } from '@silvercare/contracts/src/generated/roles'
import { getResidentStatus } from '@/lib/resident-status'

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
  /** Podopieczny zarchiwizowany lub po zgonie — w rankingu przy równym dopasowaniu idzie za aktywnym. */
  archived?: boolean
}

/** Ile kandydatów pobiera zapytanie i ile pozycji zostaje w grupie po rankingu. */
export const SEARCH_CANDIDATE_LIMIT = 12
export const SEARCH_GROUP_LIMIT = 6

export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/--+/g, '') // Usuń sekwencje komentarzy SQL
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Zachowaj tylko litery Unicode, cyfry, spacje i pojedyncze myślniki
    .replace(/\s+/g, ' ')
    .trim()
}

/** Małe litery bez znaków diakrytycznych (także ł, którego rozkład NFD nie obejmuje) — do porównań w rankingu. */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '')
}

/** 0 = każde słowo frazy jest dokładnym słowem wyniku, 1 = każde jest początkiem słowa, 2 = reszta (sam fragment). */
export function matchScore(item: Pick<SearchResultItem, 'title' | 'subtitle'>, cleanQuery: string): 0 | 1 | 2 {
  const queryWords = normalizeForSearch(cleanQuery).split(' ').filter(Boolean)
  if (queryWords.length === 0) return 2
  const words = normalizeForSearch(`${item.title} ${item.subtitle}`).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (queryWords.every((q) => words.includes(q))) return 0
  if (queryWords.every((q) => words.some((w) => w.startsWith(q)))) return 1
  return 2
}

/**
 * Porządkuje wyniki w obrębie każdej grupy: lepsze dopasowanie wyżej, przy równym aktywni przed archiwalnymi
 * (dokładny archiwalny wyprzedza prefiks aktywnego). Sortowanie stabilne, grupy zostają w kolejności pierwszego wystąpienia.
 */
export function rankSearchResults(items: SearchResultItem[], cleanQuery: string, perGroup = SEARCH_GROUP_LIMIT): SearchResultItem[] {
  const groups = new Map<SearchCategoryKey, SearchResultItem[]>()
  for (const it of items) groups.set(it.category, [...(groups.get(it.category) ?? []), it])
  const key = (it: SearchResultItem) => matchScore(it, cleanQuery) * 2 + (it.archived ? 1 : 0)
  return [...groups.values()].flatMap((group) => [...group].sort((a, b) => key(a) - key(b)).slice(0, perGroup))
}

/** Słowa frazy (po sanitizacji), do 4; imię i nazwisko wpisane razem to dwa słowa. */
export function splitSearchWords(cleanQuery: string): string[] {
  return cleanQuery.split(' ').filter(Boolean).slice(0, 4)
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

/** Wyszukiwarka jest dla personelu z kontraktu; rodzina, opiekun prawny i konto bez roli nie mają do niej dostępu. */
export function isStaffRole(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role)
}

/** Kategorie, dla których akcja ma dziś zapytania (personel dojdzie w osobnym etapie). */
const IMPLEMENTED_CATEGORIES: SearchCategoryKey[] = ['residents', 'facility', 'agenda', 'reports', 'organizations']

/** Które kategorie faktycznie odpytać: wybrana albo wszystkie dostępne dla roli. */
export function categoriesToSearch(selected: SearchCategoryKey | 'all', role?: string | null): SearchCategoryKey[] {
  const available = IMPLEMENTED_CATEGORIES.filter((c) => isCategoryAvailableForRole(c, role))
  return selected === 'all' ? available : available.filter((c) => c === selected)
}

export function formatResidentSearchResult(resident: {
  id: string
  first_name: string
  last_name: string
  room_number?: string | null
  bed_label?: string | null
  care_level?: string | null
  is_zsn?: boolean | null
  archived_at?: string | null
  death_date?: string | null
  contract_end_date?: string | null
}): SearchResultItem {
  const roomBedStr =
    resident.room_number && resident.bed_label
      ? `Pokój ${resident.room_number}, łóżko ${resident.bed_label}`
      : resident.room_number
      ? `Pokój ${resident.room_number}`
      : 'Brak przypisanego łóżka'

  // Status jako fakt, tą samą funkcją co lista podopiecznych; data zgonu lub archiwizacji w podtytule
  const status = getResidentStatus(resident)
  const isActive = status.kind === 'active'
  const subtitle = resident.death_date
    ? `Zgon: ${formatDatePl(resident.death_date)}`
    : resident.archived_at
    ? `Zarchiwizowany: ${formatDatePl(resident.archived_at)}`
    : roomBedStr
  const badge = isActive ? (resident.is_zsn ? 'ZSN' : undefined) : status.label

  return {
    id: resident.id,
    title: `${resident.first_name} ${resident.last_name}`,
    subtitle,
    href: `/admin/residents/${resident.id}`,
    category: 'residents',
    badge,
    badgeVariant: badge ? (isActive ? 'secondary' : 'outline') : undefined,
    archived: status.kind === 'archived' || status.kind === 'deceased',
  }
}

/** RRRR-MM-DD (także z czasem) → DD.MM.RRRR, bez stref czasowych. */
function formatDatePl(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
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
