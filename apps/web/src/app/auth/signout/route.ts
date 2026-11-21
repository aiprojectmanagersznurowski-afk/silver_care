import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAppRole } from '@/lib/auth/app-role'
import { getRedirectUrl } from '@/lib/url-helper'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (getAppRole(user) === 'super_admin') {
    const { error } = await supabase.rpc('finish_impersonation')
    if (error) console.warn('[IMPERSONATION_STOP_FAILED]', { code: error.code })
  }
  await supabase.auth.signOut()
  const redirectUrl = getRedirectUrl('/login', request)
  const response = NextResponse.redirect(redirectUrl, { status: 303 })
  // Podgląd placówki (sc_impersonation) nie może przeżyć wylogowania — inaczej następne konto w tej przeglądarce dziedziczy tryb tylko do odczytu
  response.cookies.delete('sc_impersonation')
  return response
}
