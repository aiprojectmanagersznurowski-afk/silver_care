'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptNationalId } from '@/lib/identity_crypto'
import { cookies } from 'next/headers'

const ALLOWED_ROLES = ['nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin']

export async function revealPeselAction(formData: FormData): Promise<{
  error?: string
  revealedValue?: string
  expiresAt?: number
}> {
  const residentId = formData.get('residentId') as string
  const password = formData.get('password') as string
  const reason = (formData.get('reason') as string) || 'NFZ_RECEPTA'

  if (!residentId || !password) {
    return { error: 'Wymagane jest podanie hasła autoryzacji krokowej.' }
  }

  const cookieStore = await cookies()
  if (cookieStore.get('sc_impersonation')) {
    return { error: 'Wgląd w dane wrażliwe jest zablokowany w trybie impersonacji.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { error: 'Brak aktywnej sesji użytkownika.' }
  }

  const role = user.app_metadata?.role || ''
  if (!ALLOWED_ROLES.includes(role)) {
    return { error: '403 Forbidden: Brak uprawnień personelu do wglądu w dane identyfikacyjne.' }
  }

  // 1. Step-Up Authentication (Weryfikacja hasła pracownika)
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: password,
  })

  if (authErr) {
    // Log failure attempt (without password, without plaintext id)
    await supabase.rpc('log_pesel_access_attempt', {
      p_resident_id: residentId,
      p_status: 'AUTH_FAILURE',
      p_reason: reason
    })
    return { error: 'Nieprawidłowe hasło pracownika. Próba została odnotowana w audycie.' }
  }

  // 2. Pobranie zaszyfrowanego identyfikatora
  const adminClient = createAdminClient()
  const { data: resident, error: resErr } = await adminClient
    .from('residents')
    .select('id, organization_id, pesel_encrypted, pesel_hash')
    .eq('id', residentId)
    .single()

  if (resErr || !resident) {
    return { error: 'Nie znaleziono pensjonariusza.' }
  }

  const callerOrg = user.app_metadata?.organization_id
  if (role === 'org_admin' || role === 'nurse' || role === 'caregiver' || role === 'paramedic') {
    if (callerOrg && resident.organization_id !== callerOrg) {
      return { error: '403 Forbidden: Pensjonariusz z innej placówki.' }
    }
  }

  if (!resident.pesel_encrypted) {
    return { error: 'Brak zaszyfrowanego numeru dla tego podopiecznego w bazie.' }
  }

  let plainNumber = ''
  try {
    plainNumber = decryptNationalId(resident.pesel_encrypted)
  } catch (err: any) {
    return { error: 'Błąd deszyfracji numeru identyfikacyjnego.' }
  }

  // 3. Log success attempt (without plaintext id)
  await supabase.rpc('log_pesel_access_attempt', {
    p_resident_id: residentId,
    p_status: 'AUTH_SUCCESS',
    p_reason: reason
  })

  // Transient reveal: client keeps it for 30s only
  return {
    revealedValue: plainNumber,
    expiresAt: Date.now() + 30000,
  }
}
