'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function deleteResidentAction(formData: FormData) {
  const residentId = formData.get('id') as string
  if (!residentId) return

  // AC4: Blokada akcji destrukcyjnych w trakcie impersonacji (403)
  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    console.warn('Blokada usuwania pensjonariusza w trakcie impersonacji')
    return { error: '403: Operacja niedozwolona w trybie impersonacji.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'org_admin') return

  // Rejestracja w audit_logs przed usunięciem rekordu (R14-audit-append-only, bez PII)
  const orgId = user.app_metadata?.organization_id
  if (orgId) {
    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: residentId,
      action: 'RESIDENT_DELETED',
      payload: { deleted_by: user.id }
    })
  }

  // Kasuje fizycznie z tabeli residents. Kaskadowe usuwanie (ON DELETE CASCADE) zwolni łóżko
  // oraz wyczyści tabelę links dla członków rodziny.
  await supabase.from('residents').delete().eq('id', residentId)

  revalidatePath('/admin')
  return { success: true }
}

export async function deleteStaffAction(formData: FormData) {
  const userId = formData.get('id') as string
  if (!userId) return

  // AC4: Blokada akcji destrukcyjnych w trakcie impersonacji (403)
  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    console.warn('Blokada usuwania personelu w trakcie impersonacji')
    return { error: '403: Operacja niedozwolona w trybie impersonacji.' }
  }
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'org_admin') return

  // Usunięcie personelu (nurse) ze zbioru auth.users wymaga uprawnień service_role
  // Musimy zabezpieczyć, by admin nie usuwał użytkowników z INNYCH organizacji.
  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(userId)
  
  if (fetchErr || !targetUser || !targetUser.user) return
  
  const targetAppMeta = targetUser.user.app_metadata || {}
  
  // Administrator może usunąć użytkownika tylko ze swojej organizacji
  if (targetAppMeta.organization_id !== user.app_metadata?.organization_id) return
  
  // Nie pozwalamy adminowi usunąć samego siebie, ani innych org_admin / super_admin
  if (targetAppMeta.role !== 'nurse' && targetAppMeta.role !== 'paramedic') return 

  // Soft delete: Zablokuj użytkownika (ban na 10 lat) i zaktualizuj app_metadata
  await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '87600h',
    app_metadata: {
      ...targetAppMeta,
      is_active: false
    }
  })
  
  revalidatePath('/admin/staff')
}
