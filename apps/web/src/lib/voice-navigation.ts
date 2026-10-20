/**
 * voice-navigation.ts — Logika nawigacji i rozwiązywania kontekstu podopiecznego.
 *
 * Implements acceptance criteria for:
 * - VOICE-ZERO-GUESSING: bezpieczny fallback wyboru podopiecznego gdy brak parametru resident.
 */

export interface VoiceResidentContext {
  hasResident: boolean
  residentId: string | null
  mode: 'record' | 'select_resident'
  returnUrl: string
}

/**
 * Rozwiązuje kontekst podopiecznego na podstawie parametrów URL.
 * Gdy parametr resident jest obecny — przełącza w tryb nagrywania z UUID.
 * Gdy parametru brakuje — bezpiecznie przełącza w tryb wyboru (bez zgadywania i bez błędu).
 */
export function resolveVoiceResidentContext(
  params: { resident?: string | null } | URLSearchParams | null | undefined
): VoiceResidentContext {
  const rawId = !params
    ? null
    : params instanceof URLSearchParams
      ? params.get('resident')
      : params.resident

  const residentId = typeof rawId === 'string' && rawId.trim() !== '' ? rawId.trim() : null

  return {
    hasResident: Boolean(residentId),
    residentId,
    mode: residentId ? 'record' : 'select_resident',
    returnUrl: '/staff',
  }
}

/**
 * Zwraca poprawny URL do widoku notatki głosowej.
 */
export function getVoiceRoute(residentId?: string | null): string {
  if (residentId && residentId.trim() !== '') {
    return `/voice?resident=${encodeURIComponent(residentId.trim())}`
  }
  return '/voice'
}
