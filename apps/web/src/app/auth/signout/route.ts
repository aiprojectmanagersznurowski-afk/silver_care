import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  // Podgląd placówki (sc_impersonation) nie może przeżyć wylogowania — inaczej następne konto w tej przeglądarce dziedziczy tryb tylko do odczytu
  response.cookies.delete('sc_impersonation')
  return response
}
