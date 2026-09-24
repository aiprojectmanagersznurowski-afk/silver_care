import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
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
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // 1. Użytkownik zalogowany — reguły RBAC
  if (user) {
    const role = user.app_metadata?.role

    // Jeśli zalogowany próbuje wejść na stronę główną/logowania, przekieruj do jego panelu
    if (path === '/' || path.startsWith('/login')) {
      if (role === 'family' || role === 'legal_guardian') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
      } else if (role === 'nurse' || role === 'paramedic' || role === 'caregiver') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/staff'
        return NextResponse.redirect(redirectUrl)
      } else if (role === 'super_admin' || role === 'org_admin' || role === 'admin' || role === 'facility_manager') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/admin'
        return NextResponse.redirect(redirectUrl)
      }
    }
    
    // Zabezpieczenie ścieżek panelowych
    if (path.startsWith('/admin') && role !== 'super_admin' && role !== 'org_admin' && role !== 'admin' && role !== 'facility_manager') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if ((path.startsWith('/staff') || path.startsWith('/voice') || path.startsWith('/reports')) && role !== 'nurse' && role !== 'paramedic' && role !== 'caregiver' && role !== 'super_admin' && role !== 'org_admin' && role !== 'admin') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } else {
    // 2. Brak sesji ciasteczkowej
    const hasBearerAuth = Boolean(request.headers.get('authorization')?.startsWith('Bearer '))

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
