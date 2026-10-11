'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Server action do przełączania kontaktu głównego podopiecznego.
 * Trigger w bazie danych automatycznie dba o to, by tylko jeden rekord miał is_primary_contact = true (SC-ADM-03 AC3).
 */
export async function setPrimaryRelativeAction(linkId: string, residentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Brak autoryzacji sesji.' }
  }

  const role = user.app_metadata?.role
  if (role !== 'org_admin' && role !== 'super_admin' && role !== 'admin') {
    return { error: 'Tylko administrator placówki może zarządzać kontaktami głównymi.' }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('resident_relative_links')
    .update({ is_primary_contact: true })
    .eq('id', linkId)
    .eq('resident_id', residentId)

  if (error) {
    return { error: 'Błąd zapisu w bazie danych: ' + error.message }
  }

  revalidatePath(`/admin/residents/${residentId}`)
  return { success: true }
}
