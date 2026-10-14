/**
 * @REQ: SEC-SESSION
 *
 * Pomocnicze funkcje wyznaczania publicznego adresu bazowego (origin) i URL-i przekierowań.
 * Zapewnia zachowanie domeny niestandardowej (np. https://silvercare.space) i zapobiega
 * niepożądanemu przełączaniu użytkownika na wewnętrzny adres wdrożenia Vercel (*.vercel.app).
 */

const DEFAULT_SITE_URL = 'https://silvercare.space'

export function getRequestOrigin(request: Request): string {
  // 1. Sprawdź nagłówki proxy
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host')
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host && host.includes('localhost') ? 'http' : 'https')

  // Jeśli żądanie przyszło na domenę inną niż domyślny *.vercel.app (np. silvercare.space lub localhost)
  if (host && !host.includes('vercel.app')) {
    return `${proto}://${host}`
  }

  // 2. Jeśli skonfigurowano zmienną środowiskową NEXT_PUBLIC_SITE_URL, użyj jej
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }

  // 3. Jeśli żądanie przyszło na pierwotny adres wdrożenia Vercel (silver-care-six.vercel.app),
  // zawsze preferuj naszą domenę domenową silvercare.space
  if (host && host.includes('silver-care-six.vercel.app')) {
    return DEFAULT_SITE_URL
  }

  // 4. Jeśli host istnieje (np. podgląd gałęzi Vercel branch preview)
  if (host) {
    return `${proto}://${host}`
  }

  // 5. Bezpieczny fallback
  try {
    const origin = new URL(request.url).origin
    if (!origin.includes('vercel.app')) {
      return origin
    }
  } catch {
    // ignore
  }

  return DEFAULT_SITE_URL
}

export function getRedirectUrl(path: string, request: Request): URL {
  const origin = getRequestOrigin(request)
  return new URL(path, origin)
}
