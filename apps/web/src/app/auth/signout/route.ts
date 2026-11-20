import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getActiveImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import { getRedirectUrl } from '@/lib/url-helper'

export async function POST(request: Request) {
  const supabase = await createClient()
  const cookieStore = await safeGetCookieStore()
  if (cookieStore.get('sc_impersonation')) {
    const { data: { user } } = await supabase.auth.getUser()
    const preview = getActiveImpersonation(cookieStore, user)
    if (preview) {
      const { error } = await supabase.rpc('log_impersonation_stop', {
        p_target_admin_id: preview.targetAdminId,
        p_target_org_id: preview.targetOrgId,
      })
      if (error) console.warn('[IMPERSONATION_STOP_FAILED]', { code: error.code })
    }
  }
  await supabase.auth.signOut()
  const redirectUrl = getRedirectUrl('/login', request)
  const response = NextResponse.redirect(redirectUrl, { status: 303 })
  // Podgląd placówki (sc_impersonation) nie może przeżyć wylogowania — inaczej następne konto w tej przeglądarce dziedziczy tryb tylko do odczytu
  response.cookies.delete('sc_impersonation')
  return response
}
