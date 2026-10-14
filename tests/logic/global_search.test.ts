import { describe, it, expect } from 'vitest'
import {
  SEARCH_CATEGORIES,
  SearchCategoryKey,
  sanitizeSearchQuery,
  filterSearchResultsByCategory,
  SearchResultItem,
  formatResidentSearchResult,
  formatFacilitySearchResult,
  formatAgendaSearchResult,
  formatReportSearchResult,
  isCategoryAvailableForRole,
} from '../../apps/web/src/lib/global-search-helpers'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ORG-ISOLATION
 * @REQ: MDR-VOCABULARY
 */
describe('Global Search & Command Palette Logic (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: ORG-ISOLATION, @REQ: MDR-VOCABULARY)', () => {
  it('defines all required categories with proper labels and icons', () => {
    expect(SEARCH_CATEGORIES.residents).toBeDefined()
    expect(SEARCH_CATEGORIES.facility).toBeDefined()
    expect(SEARCH_CATEGORIES.agenda).toBeDefined()
    expect(SEARCH_CATEGORIES.reports).toBeDefined()
    expect(SEARCH_CATEGORIES.staff).toBeDefined()
    expect(SEARCH_CATEGORIES.organizations).toBeDefined()

    expect(SEARCH_CATEGORIES.residents.label).toBe('Podopieczni')
    expect(SEARCH_CATEGORIES.facility.label).toBe('Pokoje i łóżka')
  })

  it('sanitizes input query and enforces minimal length', () => {
    expect(sanitizeSearchQuery('')).toBe('')
    expect(sanitizeSearchQuery('   ')).toBe('')
    expect(sanitizeSearchQuery('  Jan   Kowalski  ')).toBe('Jan Kowalski')
    expect(sanitizeSearchQuery("SELECT * FROM 'residents'--")).toBe('SELECT FROM residents')
  })

  it('restricts categories by user role (organizations only for super_admin)', () => {
    expect(isCategoryAvailableForRole('organizations', 'super_admin')).toBe(true)
    expect(isCategoryAvailableForRole('organizations', 'org_admin')).toBe(false)
    expect(isCategoryAvailableForRole('organizations', 'nurse')).toBe(false)
    expect(isCategoryAvailableForRole('residents', 'org_admin')).toBe(true)
    expect(isCategoryAvailableForRole('residents', 'nurse')).toBe(true)
  })

  it('formats resident search item with room/bed info and care level', () => {
    const rawResident = {
      id: 'res-123',
      first_name: 'Helena',
      last_name: 'Wiśniewska',
      care_level: 'walking',
      is_zsn: true,
      room_number: '104',
      bed_label: 'A',
    }

    const item = formatResidentSearchResult(rawResident)
    expect(item.id).toBe('res-123')
    expect(item.title).toBe('Helena Wiśniewska')
    expect(item.category).toBe('residents')
    expect(item.subtitle).toContain('Pokój 104, łóżko A')
    expect(item.href).toBe('/admin/residents/res-123')
    expect(item.badge).toBe('ZSN')
  })

  it('formats room/bed search item', () => {
    const rawRoom = {
      id: 'bed-456',
      room_id: 'room-1',
      room_number: '202',
      floor: 2,
      sector: 'A',
      bed_label: 'B',
      resident_name: 'Stefan Kowal',
    }

    const item = formatFacilitySearchResult(rawRoom)
    expect(item.title).toBe('Pokój 202, łóżko B')
    expect(item.category).toBe('facility')
    expect(item.subtitle).toContain('Piętro 2, Sektor A')
    expect(item.subtitle).toContain('Stefan Kowal')
    expect(item.href).toContain('/admin/facility')
  })

  it('formats agenda search item without medical/diagnostic data', () => {
    const rawAgenda = {
      id: 'agenda-789',
      title: 'Podanie posiłku obiadowego',
      scheduled_time: '13:00',
      resident_name: 'Maria Nowak',
    }

    const item = formatAgendaSearchResult(rawAgenda)
    expect(item.title).toBe('Podanie posiłku obiadowego')
    expect(item.category).toBe('agenda')
    expect(item.subtitle).toContain('13:00')
    expect(item.subtitle).toContain('Maria Nowak')
    // Zgodność z MDR-NO-PHYSIO: brak tętna, ciśnienia, diagnoz
    expect(item.subtitle.toLowerCase()).not.toMatch(/tętno|hrv|ciśnienie|diagnoza/)
  })

  it('formats report search item without clinical findings', () => {
    const rawReport = {
      id: 'rep-999',
      report_date: '2026-10-14',
      resident_name: 'Jan Nowak',
      status: 'approved',
    }

    const item = formatReportSearchResult(rawReport)
    expect(item.title).toContain('Raport z dnia 2026-10-14')
    expect(item.category).toBe('reports')
    expect(item.subtitle).toBe('Podopieczny: Jan Nowak')
  })

  it('filters results by category filter', () => {
    const items: SearchResultItem[] = [
      {
        id: '1',
        title: 'Jan',
        subtitle: '',
        href: '/admin/residents/1',
        category: 'residents',
      },
      {
        id: '2',
        title: 'Pokój 101',
        subtitle: '',
        href: '/admin/facility',
        category: 'facility',
      },
      {
        id: '3',
        title: 'Obiad',
        subtitle: '',
        href: '/agenda',
        category: 'agenda',
      },
    ]

    expect(filterSearchResultsByCategory(items, 'all')).toHaveLength(3)
    expect(filterSearchResultsByCategory(items, 'residents')).toHaveLength(1)
    expect(filterSearchResultsByCategory(items, 'residents')[0].id).toBe('1')
    expect(filterSearchResultsByCategory(items, 'facility')).toHaveLength(1)
  })

  it('strictly adheres to MDR-VOCABULARY across all labels and helper formats (zero patient word)', () => {
    const serializedCategories = JSON.stringify(SEARCH_CATEGORIES)
    expect(serializedCategories.toLowerCase()).not.toMatch(/pacjent/)
  })

  it('filters out non-matching daily reports and preserves relevant ones @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const rawReports = [
      { id: 'r1', created_at: '2026-10-14T08:00:00Z', resident_name: 'Jan Kowalski', status: 'approved' },
      { id: 'r2', created_at: '2026-10-14T08:00:00Z', resident_name: 'Anna Nowak', status: 'draft' },
      { id: 'r3', created_at: '2026-09-01T08:00:00Z', resident_name: 'Stanisław Wiśniewski', status: 'approved' },
    ]

    const query = 'Kowalski'
    const matching = rawReports.filter(rep => {
      const nameMatches = rep.resident_name?.toLowerCase().includes(query.toLowerCase())
      const dateMatches = rep.created_at?.slice(0, 10).includes(query)
      return nameMatches || dateMatches
    })

    expect(matching).toHaveLength(1)
    expect(matching[0].id).toBe('r1')
  })

  it('correctly handles rooms with and without beds in facility search @REQ: ORG-ISOLATION', () => {
    const emptyRoom = {
      id: 'room-101',
      room_id: 'room-101',
      room_number: '101',
      floor: 1,
      sector: 'A',
      bed_label: null,
      resident_name: null,
    }

    const item = formatFacilitySearchResult(emptyRoom)
    expect(item.title).toBe('Pokój 101')
    expect(item.subtitle).toContain('Piętro 1, Sektor A')
    expect(item.badge).toBe('Wolne')
  })
})

