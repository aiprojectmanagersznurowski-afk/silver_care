import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

  // Proste reguły routingowe na podstawie roli
  if (user) {
    const role = user.user_metadata?.role || user.app_metadata?.role
    const path = request.nextUrl.pathname

    // Jeśli użytkownik jest zalogowany, a próbuje wejść na główną stronę logowania, przekieruj go
    if (path === '/' || path.startsWith('/login')) {
      if (role === 'family') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      } else if (role === 'nurse' || role === 'paramedic') {
        const url = request.nextUrl.clone()
        url.pathname = '/staff'
        return NextResponse.redirect(url)
      } else if (role === 'admin' || role === 'facility_manager') {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
    }
    
    // Zabezpieczenie ścieżek
    if (path.startsWith('/admin') && role !== 'admin' && role !== 'facility_manager') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    if (path.startsWith('/staff') && role !== 'nurse' && role !== 'paramedic' && role !== 'admin') {
       return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  } else {
    // Brak usera - jeśli nie jest na stronie logowania / publicznej, redirect do root
    const path = request.nextUrl.pathname
    if (path !== '/' && !path.startsWith('/login') && !path.startsWith('/auth') && !path.startsWith('/register') && !path.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
