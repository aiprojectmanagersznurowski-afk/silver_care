'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import { RESIDENT_PHOTO_BUCKET } from '@/lib/resident-photo'

export interface SetResidentPhotoResult {
  success: boolean
  error?: string
}

const LOG_TAG = '[zdjecia-podopiecznych]'
const FILE_NAME = /^[A-Za-z0-9._-]+\.(webp|jpe?g|png)$/

/**
 * Ustawia zdjęcie podopiecznego po wgraniu pliku do prywatnego bucketu (SC-ADM-25, @REQ: ADM-RESIDENT-PHOTO).
 * Plik wgrywa przeglądarka sesją kierownika (polityki storage sprawdzają rolę i placówkę); tu: rola z app_metadata,
 * ścieżka dokładnie <organization_id>/<resident_id>/<plik>, plik istnieje, zapis photo_path, usunięcie starego pliku,
 * audyt bez danych osobowych. W logu wyłącznie kody.
 */
export async function setResidentPhotoAction(residentId: string, path: string): Promise<SetResidentPhotoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) return { success: false, error: guard.error }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (user.app_metadata?.role !== 'org_admin' || !orgId) {
    return { success: false, error: 'Zdjęcie podopiecznego zmienia wyłącznie kierownik placówki.' }
  }

  const [folderOrg, folderSubject, fileName, ...rest] = (path || '').split('/')
  if (rest.length > 0 || folderOrg !== orgId || folderSubject !== residentId || !FILE_NAME.test(fileName || '')) {
    return { success: false, error: 'Nieprawidłowa ścieżka zdjęcia.' }
  }

  const { data: row, error: readError } = await supabase
    .from('residents')
    .select('id, organization_id, photo_path')
    .eq('id', residentId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (readError || !row) {
    if (readError) console.error(LOG_TAG, 'odczyt nieudany', { code: readError.code })
    return { success: false, error: 'Nie znaleziono podopiecznego w tej placówce.' }
  }

  const bucket = supabase.storage.from(RESIDENT_PHOTO_BUCKET)
  const { data: listed } = await bucket.list(`${orgId}/${residentId}`, { search: fileName })
  if (!listed?.some((f) => f.name === fileName)) {
    return { success: false, error: 'Nie znaleziono wgranego pliku zdjęcia.' }
  }

  const { error: updateError } = await supabase.from('residents').update({ photo_path: path }).eq('id', residentId)
  if (updateError) {
    console.error(LOG_TAG, 'zapis nieudany', { code: updateError.code })
    return { success: false, error: 'Nie udało się zapisać zdjęcia.' }
  }

  const previous = (row as { photo_path?: string | null }).photo_path
  if (previous && previous !== path) {
    const { error: removeError } = await bucket.remove([previous])
    if (removeError) console.error(LOG_TAG, 'usunięcie starego pliku nieudane')
  }

  const { error: auditError } = await createAdminClient().from('audit_logs').insert({
    organization_id: orgId,
    performed_by: user.id,
    action: 'RESIDENT_PHOTO_CHANGED',
    payload: { target_table: 'residents', target_id: residentId, replaced: Boolean(previous) },
  })
  if (auditError) console.error(LOG_TAG, 'audyt nieudany', { code: auditError.code })

  revalidatePath(`/admin/residents/${residentId}`)
  return { success: true }
}
