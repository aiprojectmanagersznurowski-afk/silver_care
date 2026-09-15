'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { validateDeactivationConfirmation, generateTemporaryPassword } from '@/lib/staff-helpers'

export async function resetStaffPasswordAction(formData: FormData) {
  const staffId = formData.get('staffId') as string
  const mode = (formData.get('mode') as string) || 'email'

  if (!staffId) return { error: 'Brak identyfikatora pracownika.' }

  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    return { error: 'Akcje administracyjne są zablokowane w trybie impersonacji.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak aktywnej sesji.' }

  const callerRole = user.app_metadata?.role
  const callerOrg = user.app_metadata?.organization_id

  if (callerRole !== 'org_admin' && callerRole !== 'super_admin' && callerRole !== 'admin') {
    return { error: 'Brak uprawnień do zarządzania kontami personelu.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(staffId)

  if (fetchErr || !targetUser?.user) {
    return { error: 'Nie znaleziono wskazanego pracownika.' }
  }

  const targetOrg = targetUser.user.app_metadata?.organization_id
  if (callerRole === 'org_admin' && targetOrg !== callerOrg) {
    return { error: '403: Nie masz uprawnień do pracownika z innej placówki.' }
  }

  let tempPassword = ''
  if (mode === 'temp') {
    tempPassword = generateTemporaryPassword()
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
      password: tempPassword,
      app_metadata: {
        ...targetUser.user.app_metadata,
        must_change_password: true
      }
    })
    if (updateErr) return { error: 'Błąd generowania hasła: ' + updateErr.message }
  } else {
    // Wysłanie linku recovery
    if (targetUser.user.email) {
      const { error: resetErr } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: targetUser.user.email
      })
      if (resetErr) return { error: 'Błąd generowania linku resetującego: ' + resetErr.message }
    }
  }

  // AC3: Natychmiastowe unieważnienie aktywnych sesji pracownika
  try {
    await adminClient.auth.admin.signOut(staffId, 'global')
  } catch (err) {
    // ignoruj jeśli brak aktywnych sesji
  }

  // Rejestracja w audit_logs
  await supabase.rpc('log_staff_management_action', {
    p_target_user_id: staffId,
    p_action: 'staff_password_reset',
    p_organization_id: targetOrg || callerOrg
  })

  revalidatePath('/admin/staff')
  return {
    success: true,
    message: mode === 'temp'
      ? `Wygenerowano hasło tymczasowe: ${tempPassword} (wymagana zmiana przy logowaniu).`
      : 'Wysłano link do resetu hasła na adres e-mail pracownika.'
  }
}

export async function suspendStaffAction(formData: FormData) {
  const staffId = formData.get('staffId') as string
  const confirmation = formData.get('confirmation') as string

  if (!staffId) return { error: 'Brak identyfikatora pracownika.' }

  if (!validateDeactivationConfirmation(confirmation)) {
    return { error: 'Błędne potwierdzenie. Wpisz dokładnie słowo DEZAKTYWUJ.' }
  }

  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    return { error: 'Akcje administracyjne są zablokowane w trybie impersonacji.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak aktywnej sesji.' }

  const callerRole = user.app_metadata?.role
  const callerOrg = user.app_metadata?.organization_id

  if (callerRole !== 'org_admin' && callerRole !== 'super_admin' && callerRole !== 'admin') {
    return { error: 'Brak uprawnień do zarządzania kontami personelu.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(staffId)

  if (fetchErr || !targetUser?.user) {
    return { error: 'Nie znaleziono wskazanego pracownika.' }
  }

  const targetOrg = targetUser.user.app_metadata?.organization_id
  if (callerRole === 'org_admin' && targetOrg !== callerOrg) {
    return { error: '403: Nie masz uprawnień do pracownika z innej placówki.' }
  }

  // Zawieś konto: ban na 10 lat + is_active: false
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
    ban_duration: '87600h',
    app_metadata: {
      ...targetUser.user.app_metadata,
      is_active: false
    }
  })

  if (updateErr) return { error: 'Błąd zawieszania konta: ' + updateErr.message }

  // AC3: Natychmiastowe unieważnienie sesji
  try {
    await adminClient.auth.admin.signOut(staffId, 'global')
  } catch (err) {
    // ignore
  }

  // Audyt
  await supabase.rpc('log_staff_management_action', {
    p_target_user_id: staffId,
    p_action: 'staff_suspended',
    p_organization_id: targetOrg || callerOrg
  })

  revalidatePath('/admin/staff')
  return { success: true, message: 'Konto pracownika zostało pomyślnie zawieszone.' }
}

export async function restoreStaffAction(formData: FormData) {
  const staffId = formData.get('staffId') as string
  if (!staffId) return { error: 'Brak identyfikatora pracownika.' }

  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    return { error: 'Akcje administracyjne są zablokowane w trybie impersonacji.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Brak aktywnej sesji.' }

  const callerRole = user.app_metadata?.role
  const callerOrg = user.app_metadata?.organization_id

  if (callerRole !== 'org_admin' && callerRole !== 'super_admin' && callerRole !== 'admin') {
    return { error: 'Brak uprawnień do zarządzania kontami personelu.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(staffId)

  if (fetchErr || !targetUser?.user) {
    return { error: 'Nie znaleziono wskazanego pracownika.' }
  }

  const targetOrg = targetUser.user.app_metadata?.organization_id
  if (callerRole === 'org_admin' && targetOrg !== callerOrg) {
    return { error: '403: Nie masz uprawnień do pracownika z innej placówki.' }
  }

  // Przywróć konto: odblokuj ban + is_active: true
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
    ban_duration: 'none',
    app_metadata: {
      ...targetUser.user.app_metadata,
      is_active: true
    }
  })

  if (updateErr) return { error: 'Błąd przywracania konta: ' + updateErr.message }

  // Audyt
  await supabase.rpc('log_staff_management_action', {
    p_target_user_id: staffId,
    p_action: 'staff_restored',
    p_organization_id: targetOrg || callerOrg
  })

  revalidatePath('/admin/staff')
  return { success: true, message: 'Konto pracownika zostało pomyślnie przywrócone.' }
}
