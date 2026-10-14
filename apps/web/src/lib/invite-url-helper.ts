/**
 * Pomocnik walidacji i routingu dla strony akceptacji zaproszenia (/accept-invite).
 * Zgodny z @REQ: ADM-INVITE, @REQ: FAM-ONBOARDING, @REQ: UI-FOUR-STATES.
 */

export type AcceptInviteState = 'LOADING' | 'EMPTY' | 'ACTION_READY' | 'REDIRECT' | 'ERROR'

export interface AcceptInviteResolution {
  state: AcceptInviteState
  destinationUrl?: string
  errorCode?: 'MISSING_PARAMS' | 'INVALID_URL' | 'EXPIRED'
  errorMessage?: string
}

/**
 * Weryfikuje czy dany adres URL przekierowania jest bezpieczny i nie stanowi luki Open Redirect.
 */
export function validateRedirectUrl(
  url: string | null | undefined,
  currentOrigin: string
): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return false
  }

  // Bezpieczna ścieżka wewnętrzna (musi zaczynać się od '/', ale nie '//')
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }

  try {
    const parsed = new URL(trimmed)

    // Tylko protokoły http i https
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false
    }

    // Sprawdzenie zgodności z origin aplikacji
    if (currentOrigin) {
      try {
        const originUrl = new URL(currentOrigin)
        if (parsed.origin === originUrl.origin) {
          return true
        }
      } catch {
        // Ignoruj błąd parsowania origin
      }
    }

    // Zaufane domeny Supabase Auth
    if (parsed.hostname.endsWith('.supabase.co') || parsed.hostname === 'supabase.co') {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Rozstrzyga stan strony /accept-invite na podstawie parametrów query.
 */
export function resolveAcceptInviteAction(
  params: { token?: string | null; url?: string | null },
  currentOrigin: string
): AcceptInviteResolution {
  const { token, url } = params

  // 1. Jeśli przekazano token (zaproszenie bliskiego / opiekuna prawnego)
  if (token && typeof token === 'string' && token.trim()) {
    return {
      state: 'REDIRECT',
      destinationUrl: `/register?token=${encodeURIComponent(token.trim())}`,
    }
  }

  // 2. Jeśli przekazano parametr url (link aktywacji Supabase personelu / administratora)
  if (url && typeof url === 'string' && url.trim()) {
    const isValid = validateRedirectUrl(url, currentOrigin)
    if (isValid) {
      return {
        state: 'ACTION_READY',
        destinationUrl: url.trim(),
      }
    }

    return {
      state: 'ERROR',
      errorCode: 'INVALID_URL',
      errorMessage: 'Podany link aktywacyjny jest nieprawidłowy lub niebezpieczny.',
    }
  }

  // 3. Brak parametrów
  return {
    state: 'EMPTY',
    errorCode: 'MISSING_PARAMS',
    errorMessage: 'Brak tokena lub linku zaproszenia. Użyj linku otrzymanego w wiadomości e-mail.',
  }
}
