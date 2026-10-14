import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  VIEW_PREFERENCE_KEYS,
  validateViewPreference,
  getViewPreferenceInitial,
} from '../../apps/web/src/hooks/use-view-preference'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 */
describe('Persistent View Preferences Logic (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  beforeEach(() => {
    // Czysty mock pamięci localStorage
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        for (const k in store) delete store[k]
      },
    })
  })

  it('defines stable preference storage keys for facility, staff board, residents, and organizations', () => {
    expect(VIEW_PREFERENCE_KEYS.facilityRooms).toBe('silver_care_facility_room_view_mode')
    expect(VIEW_PREFERENCE_KEYS.staffBoard).toBe('silvercare_staff_board_view')
    expect(VIEW_PREFERENCE_KEYS.organizations).toBe('silver_care_org_view_mode')
    expect(VIEW_PREFERENCE_KEYS.residents).toBe('silvercare_residents_view')
  })

  it('validates allowed modes strictly', () => {
    const allowed = ['grid', 'table'] as const
    expect(validateViewPreference('grid', allowed, 'grid')).toBe('grid')
    expect(validateViewPreference('table', allowed, 'grid')).toBe('table')
    // Nieprawidłowa wartość ze storage
    expect(validateViewPreference('malicious_invalid_mode', allowed, 'grid')).toBe('grid')
    expect(validateViewPreference(null, allowed, 'grid')).toBe('grid')
  })

  it('reads initial preference from localStorage or falls back to default', () => {
    const allowed = ['rounds', 'standard'] as const

    // 1. Brak w storage -> zwraca default
    expect(getViewPreferenceInitial('test_key', 'rounds', allowed)).toBe('rounds')

    // 2. Poprawna wartość w storage
    localStorage.setItem('test_key', 'standard')
    expect(getViewPreferenceInitial('test_key', 'rounds', allowed)).toBe('standard')

    // 3. Uszkodzona wartość w storage -> fallback na default
    localStorage.setItem('test_key', 'corrupted')
    expect(getViewPreferenceInitial('test_key', 'rounds', allowed)).toBe('rounds')

    // 4. Wsteczna kompatybilność dla klucza organizacji
    localStorage.setItem('silver_care_org_view_mode', 'table')
    expect(
      getViewPreferenceInitial(VIEW_PREFERENCE_KEYS.organizations, 'cards', ['cards', 'table'] as const)
    ).toBe('table')

    // 5. Wsteczna kompatybilność dla klucza pokojów
    localStorage.setItem('silver_care_facility_room_view_mode', 'table')
    expect(
      getViewPreferenceInitial(VIEW_PREFERENCE_KEYS.facilityRooms, 'grid', ['grid', 'table'] as const)
    ).toBe('table')
  })

  it('handles SSR gracefully when window is undefined', () => {
    const allowed = ['cards', 'table'] as const
    const originalWindow = global.window
    const originalStorage = global.localStorage

    // @ts-expect-error symulacja SSR
    delete global.window
    // @ts-expect-error symulacja braku storage w SSR
    delete global.localStorage

    expect(getViewPreferenceInitial('test_key', 'cards', allowed)).toBe('cards')

    // Przywrócenie window i localStorage
    global.window = originalWindow
    global.localStorage = originalStorage
  })
})
