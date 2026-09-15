'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validatePasswordStrength } from '@/lib/password'

export async function changePasswordAction(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Wszystkie pola hasła są wymagane.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Nowe hasło i potwierdzenie nie są identyczne.' }
  }

  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    return { error: strength.message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Brak autoryzowanej sesji użytkownika.' }
  }

  // Weryfikacja bieżącego hasła
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (verifyErr) {
    return { error: 'Bieżące hasło jest niepoprawne.' }
  }

  // Zmiana hasła
  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateErr) {
    return { error: 'Nie udało się zaktualizować hasła: ' + updateErr.message }
  }

  // Rejestracja w audit i security_access_logs
  await supabase.rpc('log_self_password_change')

  revalidatePath('/settings/profile')
  return { success: true, message: 'Hasło zostało pomyślnie zmienione.' }
}

export async function signOutOthersAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Brak autoryzowanej sesji.' }
  }

  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) {
    return { error: 'Nie udało się wylogować pozostałych sesji: ' + error.message }
  }

  revalidatePath('/settings/profile')
  return { success: true, message: 'Wylogowano ze wszystkich pozostałych urządzeń.' }
}

export async function getProfileSecurityData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: logs } = await supabase
    .from('security_access_logs')
    .select('*')
    .eq('performed_by', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'user',
      organizationId: user.app_metadata?.organization_id || null,
      lastSignInAt: user.last_sign_in_at,
    },
    logs: logs || [],
  }
}
