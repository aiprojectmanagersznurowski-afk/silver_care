'use server'

import { revalidatePath } from 'next/cache'
import { validateDeactivationConfirmation, generateTemporaryPassword } from '@/lib/staff-helpers'
import {
  verifyStaffManagerAndTarget,
  logStaffAction,
  StaffActionResult
} from '@/lib/staff-management-helpers'

export async function resetStaffPasswordAction(formData: FormData): Promise<StaffActionResult> {
  try {
    const staffId = formData.get('staffId') as string
    const mode = (formData.get('mode') as string) || 'email'

    const check = await verifyStaffManagerAndTarget(staffId)
    if (!check.success) {
      return { error: check.error }
    }

    const { supabase, adminClient, callerUser, targetUser, targetOrg } = check

    let tempPassword = ''
    if (mode === 'temp') {
      tempPassword = generateTemporaryPassword()
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
        password: tempPassword,
        app_metadata: {
          ...targetUser.app_metadata,
          must_change_password: true
        }
      })
      if (updateErr) return { error: 'Błąd generowania hasła: ' + updateErr.message }
    } else {
      if (targetUser.email) {
        const { error: resetErr } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: targetUser.email
        })
        if (resetErr) return { error: 'Błąd generowania linku resetującego: ' + resetErr.message }
      }
    }

    await logStaffAction(
      supabase,
      adminClient,
      callerUser.id,
      staffId,
      'staff_password_reset',
      targetOrg
    )

    revalidatePath('/admin/staff')
    return {
      success: true,
      message: mode === 'temp'
        ? `Wygenerowano hasło tymczasowe: ${tempPassword} (wymagana zmiana przy logowaniu).`
        : 'Wysłano link do resetu hasła na adres e-mail pracownika.'
    }
  } catch (err: unknown) {
    console.error('Błąd w resetStaffPasswordAction:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas resetu hasła.' }
  }
}

export async function suspendStaffAction(formData: FormData): Promise<StaffActionResult> {
  try {
    const staffId = formData.get('staffId') as string
    const confirmation = formData.get('confirmation') as string

    if (!staffId) {
      return { error: 'Brak identyfikatora pracownika.' }
    }

    if (!validateDeactivationConfirmation(confirmation)) {
      return { error: 'Błędne potwierdzenie. Wpisz dokładnie słowo DEZAKTYWUJ.' }
    }

    const check = await verifyStaffManagerAndTarget(staffId)
    if (!check.success) {
      return { error: check.error }
    }

    const { supabase, adminClient, callerUser, targetUser, targetOrg } = check

    // Zawieś konto: ban na 10 lat + is_active: false
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
      ban_duration: '87600h',
      app_metadata: {
        ...targetUser.app_metadata,
        is_active: false
      }
    })

    if (updateErr) return { error: 'Błąd zawieszania konta: ' + updateErr.message }

    await logStaffAction(
      supabase,
      adminClient,
      callerUser.id,
      staffId,
      'staff_suspended',
      targetOrg
    )

    revalidatePath('/admin/staff')
    return { success: true, message: 'Konto pracownika zostało pomyślnie zawieszone.' }
  } catch (err: unknown) {
    console.error('Błąd w suspendStaffAction:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas zawieszania konta.' }
  }
}

export async function restoreStaffAction(formData: FormData): Promise<StaffActionResult> {
  try {
    const staffId = formData.get('staffId') as string

    const check = await verifyStaffManagerAndTarget(staffId)
    if (!check.success) {
      return { error: check.error }
    }

    const { supabase, adminClient, callerUser, targetUser, targetOrg } = check

    // Przywróć konto: odblokuj ban + is_active: true
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(staffId, {
      ban_duration: 'none',
      app_metadata: {
        ...targetUser.app_metadata,
        is_active: true
      }
    })

    if (updateErr) return { error: 'Błąd przywracania konta: ' + updateErr.message }

    await logStaffAction(
      supabase,
      adminClient,
      callerUser.id,
      staffId,
      'staff_restored',
      targetOrg
    )

    revalidatePath('/admin/staff')
    return { success: true, message: 'Konto pracownika zostało pomyślnie przywrócone.' }
  } catch (err: unknown) {
    console.error('Błąd w restoreStaffAction:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas przywracania konta.' }
  }
}
