'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOrganizationAction(formData: FormData) {
  const orgName = (formData.get('orgName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const residentLimitRaw = formData.get('residentLimit') as string
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const adminFullName = (formData.get('adminFullName') as string)?.trim() || null

  if (!orgName) {
    return { error: 'Nazwa placówki jest wymagana.' }
  }

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) {
    return { error: 'Podano nieprawidłowy adres e-mail administratora.' }
  }

  const residentLimit = residentLimitRaw && !isNaN(Number(residentLimitRaw))
    ? Math.max(1, parseInt(residentLimitRaw, 10))
    : 50

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const { data: orgId, error: rpcErr } = await supabase.rpc('provision_organization', {
      p_org_name: orgName,
      p_admin_email: adminEmail,
      p_address: address,
      p_resident_limit: residentLimit,
      p_admin_full_name: adminFullName
    })

    if (rpcErr) {
      console.error('Błąd provisioningu placówki:', rpcErr)
      return { error: 'Błąd tworzenia placówki: ' + rpcErr.message }
    }

    revalidatePath('/admin/organizations')

    return {
      success: true,
      organizationId: orgId as string,
      orgName,
      adminEmail
    }
  } catch (err: unknown) {
    console.error('Nieoczekiwany błąd serwera:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}
