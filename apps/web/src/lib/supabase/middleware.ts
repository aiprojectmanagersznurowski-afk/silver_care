import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MFA_REQUIRED_ROLES } from '@silvercare/contracts/src/generated/roles'
import { DEVICE_INGEST_PROTOCOL } from '@silvercare/contracts/src/generated/integration'
import { getAppRole } from '@/lib/auth/app-role'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'

const mfaRoles = new Set<string>(MFA_REQUIRED_ROLES)

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const path = request.nextUrl.pathname
  // These handlers verify the recorder credential independently of user sessions.
  if (DEVICE_INGEST_PROTOCOL.wire.requests.some((step) => step.path === path)) return supabaseResponse

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return supabaseResponse
  }

  const isApi = path.startsWith('/api/')
  const authorization = request.headers.get('authorization')
  const bearer = isApi ? authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() : undefined

  const supabase = createServerClient(
    url,
    anonKey,
    {
      global: bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : undefined,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser(bearer)

  // 1. Użytkownik zalogowany — reguły RBAC
  if (user) {
    const role = getAppRole(user)
    const read = request.method === 'GET' || request.method === 'HEAD'
    if (read && path === '/login/mfa') return supabaseResponse

    const portal = /^\/(?:admin|staff|voice|reports)(?:\/|$)/.test(path)
    const login = path === '/' || path === '/login'
    const mutation = !read && !path.startsWith('/auth/')
    if (role && mfaRoles.has(role) && (portal || login || isApi || mutation)) {
      const { data } = await supabase.auth.getClaims(bearer)
      if (data?.claims.sub !== user.id || !await staffMfaSatisfied(supabase, data.claims.aal)) {
        if (isApi || !read) {
          return NextResponse.json(
            { error: 'Potwierdź drugi składnik uwierzytelniania.', code: 'MFA_REQUIRED' },
            { status: 403 },
          )
        }
        const url = new URL('/login/mfa', request.url)
        url.searchParams.set('returnTo', login ? '/' : path + request.nextUrl.search)
        const response = NextResponse.redirect(url)
        for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie)
        return response
      }
    }

    // Jeśli zalogowany próbuje wejść na stronę główną/logowania, przekieruj do jego panelu
    if (path === '/' || path.startsWith('/login')) {
      if (role === 'family' || role === 'legal_guardian') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
      } else if (role === 'nurse') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/staff'
        return NextResponse.redirect(redirectUrl)
      } else if (role === 'super_admin' || role === 'org_admin') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/admin'
        return NextResponse.redirect(redirectUrl)
      }
    }
    
    // Zabezpieczenie ścieżek panelowych
    if (path.startsWith('/admin') && role !== 'super_admin' && role !== 'org_admin') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if ((path.startsWith('/staff') || path.startsWith('/voice') || path.startsWith('/reports')) && role !== 'nurse' && role !== 'super_admin' && role !== 'org_admin') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } else {
    // 2. Brak sesji ciasteczkowej
    const hasBearerAuth = Boolean(bearer)

    // Precyzyjna biała lista publicznych tras API
    const isPublicApiRoute =
      path === '/api/family/invite/validate' ||
      path === '/api/family/register' ||
      path === '/api/polar/webhook'

    if (path.startsWith('/api')) {
      // Jeśli to trasa API, zezwól wyłącznie na publiczne lub z nagłówkiem Bearer
      if (!isPublicApiRoute && !hasBearerAuth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return supabaseResponse
    }

    const isPublicPage = 
      path === '/' || 
      path === '/manifest.json' ||
      path === '/sw.js' ||
      path === '/offline.html' ||
      path.startsWith('/login') || 
      path.startsWith('/auth') || 
      path.startsWith('/register') || 
      path.startsWith('/accept-invite') ||
      path.startsWith('/update-password') ||
      path.startsWith('/unauthorized')


    if (!isPublicPage) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}
