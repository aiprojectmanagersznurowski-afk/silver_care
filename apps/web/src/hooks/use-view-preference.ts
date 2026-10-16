'use client'

import { useState, useEffect, useCallback } from 'react'

export const VIEW_PREFERENCE_KEYS = {
  facilityRooms: 'silver_care_facility_room_view_mode',
  staffBoard: 'silvercare_staff_board_view',
  organizations: 'silver_care_org_view_mode',
  residents: 'silvercare_residents_view',
} as const

export function validateViewPreference<T extends string>(
  storedValue: unknown,
  allowedModes: readonly T[],
  defaultMode: T
): T {
  if (typeof storedValue === 'string' && (allowedModes as readonly string[]).includes(storedValue)) {
    return storedValue as T
  }
  return defaultMode
}

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage
  }
  return null
}

export function getViewPreferenceInitial<T extends string>(
  key: string,
  defaultMode: T,
  allowedModes: readonly T[]
): T {
  const storage = getStorage()
  if (!storage) {
    return defaultMode
  }
  try {
    let raw = storage.getItem(key)
    if (!raw && key === VIEW_PREFERENCE_KEYS.organizations) {
      raw = storage.getItem('silver_care_org_view_mode')
    }
    if (!raw && key === VIEW_PREFERENCE_KEYS.facilityRooms) {
      raw = storage.getItem('silver_care_facility_room_view_mode')
    }
    return validateViewPreference(raw, allowedModes, defaultMode)
  } catch {
    return defaultMode
  }
}

/**
 * Uniwersalny hook do trwałego zapamiętywania preferencji widoków UI w localStorage
 * Zapewnia pełne bezpieczeństwo SSR (brak błędów hydratacji).
 */
export function useViewPreference<T extends string>(
  key: string,
  defaultMode: T,
  allowedModes: readonly T[]
): [T, (newMode: T) => void, boolean] {
  const [mode, setMode] = useState<T>(defaultMode)
  const [isLoaded, setIsLoaded] = useState(false)

  // Inicjalizacja po montowaniu w przeglądarce (SSR safe)
  useEffect(() => {
    void Promise.resolve().then(() => {
      const initial = getViewPreferenceInitial(key, defaultMode, allowedModes)
      setMode(initial)
      setIsLoaded(true)
    })
  }, [key, defaultMode, allowedModes])

  const setViewMode = useCallback(
    (newMode: T) => {
      const validated = validateViewPreference(newMode, allowedModes, defaultMode)
      setMode(validated)
      const storage = getStorage()
      if (storage) {
        try {
          storage.setItem(key, validated)
        } catch {
          // Ignoruj błędy zapisu (np. quota exceeded w trybie incognito)
        }
      }
    },
    [key, allowedModes, defaultMode]
  )

  return [mode, setViewMode, isLoaded]
}
