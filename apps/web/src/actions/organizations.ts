'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validateOrganizationUpdate } from '@/lib/org-helpers'
import { sendAdminInviteEmail, executeAdminAssignment } from '@/lib/org-admin-invite'
import { findUserByEmail, evaluateAdminAssignment } from '@/lib/admin-assign-safety'

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

    const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)

    revalidatePath('/admin/organizations')

    return {
      success: true,
      organizationId: orgId as string,
      orgName,
      adminEmail,
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent
    }
  } catch (err: unknown) {
    console.error('Nieoczekiwany błąd serwera:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function resendAdminInviteAction(formData: FormData) {
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim() || 'placówce'

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)

    if (orgId) {
      revalidatePath(`/admin/organizations/${orgId}`)
    }

    return {
      success: true,
      adminEmail,
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent
    }
  } catch (err: unknown) {
    console.error('Błąd ponownej wysyłki zaproszenia:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function addAdminToOrganizationAction(formData: FormData) {
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim() || 'placówki'
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const adminFullName = (formData.get('adminFullName') as string)?.trim() || null

  if (!orgId) {
    return { error: 'Identyfikator placówki jest wymagany.' }
  }

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) {
    return { error: 'Podano nieprawidłowy adres e-mail administratora.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const adminClient = createAdminClient()
    const existingUser = await findUserByEmail(adminClient, adminEmail)
    const assignmentDecision = evaluateAdminAssignment({
      existingUser,
      targetOrgId: orgId,
    })

    if (!assignmentDecision.allowed) {
      return { error: assignmentDecision.error }
    }

    const result = await executeAdminAssignment(
      supabase,
      adminClient,
      existingUser,
      orgId,
      orgName,
      adminEmail,
      adminFullName,
      user.id
    )

    if (result.error) {
      return { error: result.error }
    }

    revalidatePath(`/admin/organizations/${orgId}`)

    return {
      success: true,
      adminEmail,
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent
    }
  } catch (err: unknown) {
    console.error('Błąd dodawania administratora do placówki:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function updateOrganizationAction(formData: FormData) {
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const residentLimitRaw = formData.get('residentLimit') as string

  if (!orgId) {
    return { error: 'Identyfikator placówki jest wymagany.' }
  }

  const validation = validateOrganizationUpdate({
    orgName,
    residentLimit: residentLimitRaw,
    address
  })

  if (!validation.valid || !validation.data) {
    return { error: validation.error || 'Nieprawidłowe dane formularza.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const { data: updatedOrg, error: updateErr } = await supabase
      .from('organizations')
      .update({
        name: validation.data.orgName,
        address: validation.data.address,
        resident_limit: validation.data.residentLimit
      })
      .eq('id', orgId)
      .select()
      .single()

    if (updateErr) {
      console.error('Błąd aktualizacji placówki:', updateErr)
      return { error: 'Błąd aktualizacji placówki: ' + updateErr.message }
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      action: 'ORGANIZATION_UPDATED',
      performed_by: user.id,
      payload: {
        organization_name: validation.data.orgName,
        address: validation.data.address,
        resident_limit: validation.data.residentLimit
      }
    })

    revalidatePath('/admin/organizations')
    revalidatePath(`/admin/organizations/${orgId}`)

    return {
      success: true,
      organization: updatedOrg
    }
  } catch (err: unknown) {
    console.error('Nieoczekiwany błąd serwera podczas aktualizacji placówki:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}
