'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface ImpersonationSession {
  targetAdminId: string
  targetOrgId: string
  targetOrgName: string
  adminEmail: string
  impersonatorId: string
  startedAt: string
}

export async function startImpersonationAction(formData: FormData): Promise<void> {
  const targetAdminId = (formData.get('targetAdminId') as string)?.trim()
  const targetOrgId = (formData.get('targetOrgId') as string)?.trim()
  const targetOrgName = (formData.get('targetOrgName') as string)?.trim()
  const adminEmail = (formData.get('adminEmail') as string)?.trim()

  if (!targetAdminId || !targetOrgId) {
    throw new Error('Brak wymaganych parametrów docelowego administratora.')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || role !== 'super_admin') {
    throw new Error('Odmowa dostępu. Wymagana rola super_admin.')
  }

  // 1. Zapis audytowy w bazie (IMPERSONATE_START)
  const { error: rpcErr } = await supabase.rpc('log_impersonation_start', {
    p_target_admin_id: targetAdminId,
    p_target_org_id: targetOrgId
  })

  if (rpcErr) {
    console.error('Błąd log_impersonation_start:', rpcErr)
    throw new Error('Błąd rejestracji audytu: ' + rpcErr.message)
  }

  // 2. Utworzenie sesji impersonacji z TTL = 1h (AC2)
  const sessionData: ImpersonationSession = {
    targetAdminId,
    targetOrgId,
    targetOrgName: targetOrgName || 'Placówka',
    adminEmail: adminEmail || '',
    impersonatorId: user.id,
    startedAt: new Date().toISOString()
  }

  const cookieStore = await cookies()
  cookieStore.set('sc_impersonation', JSON.stringify(sessionData), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600 // 1 godzina TTL
  })

  redirect('/admin')
}

export async function stopImpersonationAction() {
  const cookieStore = await cookies()
  const rawSession = cookieStore.get('sc_impersonation')?.value

  let targetOrgId = ''

  if (rawSession) {
    try {
      const session: ImpersonationSession = JSON.parse(rawSession)
      targetOrgId = session.targetOrgId

      const supabase = await createClient()
      await supabase.rpc('log_impersonation_stop', {
        p_target_admin_id: session.targetAdminId,
        p_target_org_id: session.targetOrgId
      })
    } catch (e) {
      console.error('Błąd log_impersonation_stop:', e)
    }
  }

  cookieStore.delete('sc_impersonation')

  if (targetOrgId) {
    redirect(`/admin/organizations/${targetOrgId}`)
  } else {
    redirect('/admin/organizations')
  }
}
