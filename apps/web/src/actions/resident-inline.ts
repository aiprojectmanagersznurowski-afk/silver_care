'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface UpdateResidentPayload {
  residentId: string
  first_name?: string
  last_name?: string
  birth_date?: string | null
  care_level?: 'walking' | 'sitting' | 'bedridden' | 'hospice' | null
  notes?: string | null
  admission_date?: string | null
  is_zsn?: boolean
}

export interface UpdateResidentResult {
  success: boolean
  error?: string
  data?: Partial<UpdateResidentPayload>
}

export async function updateResidentInlineAction(
  payload: UpdateResidentPayload
): Promise<UpdateResidentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Brak aktywnej sesji użytkownika.' }
  }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined

  // Weryfikacja uprawnień wg MATRIX: residents update dozwolony dla org_admin oraz super_admin
  const allowedRoles = ['org_admin', 'super_admin']
  if (!role || !allowedRoles.includes(role)) {
    return {
      success: false,
      error: 'Brak uprawnień do edycji podopiecznego (wymagana rola administratora placówki).',
    }
  }

  if (!orgId && role !== 'super_admin') {
    return { success: false, error: 'Brak przypisanej placówki dla konta.' }
  }

  if (!payload.residentId) {
    return { success: false, error: 'Brak identyfikatora podopiecznego.' }
  }

  const adminClient = createAdminClient()

  // Pobierz podopiecznego i zweryfikuj przynależność do placówki
  const { data: resident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, first_name, last_name, care_level, notes, is_zsn, birth_date, admission_date')
    .eq('id', payload.residentId)
    .single()

  if (fetchErr || !resident) {
    return { success: false, error: 'Nie znaleziono wskazanego podopiecznego.' }
  }

  if (role !== 'super_admin' && resident.organization_id !== orgId) {
    return { success: false, error: 'Brak dostępu do podopiecznego z innej placówki.' }
  }

  // Przygotowanie bezpiecznego payloadu (tylko dozwolone kolumny)
  const updateData: Record<string, string | boolean | null> = {}

  if (payload.first_name !== undefined) {
    const trimmed = payload.first_name.trim()
    if (!trimmed) {
      return { success: false, error: 'Imię nie może być puste.' }
    }
    updateData.first_name = trimmed
  }

  if (payload.last_name !== undefined) {
    const trimmed = payload.last_name.trim()
    if (!trimmed) {
      return { success: false, error: 'Nazwisko nie może być puste.' }
    }
    updateData.last_name = trimmed
  }

  if (payload.care_level !== undefined) {
    const validLevels = ['walking', 'sitting', 'bedridden', 'hospice', null]
    if (!validLevels.includes(payload.care_level)) {
      return { success: false, error: 'Nieprawidłowy poziom opieki.' }
    }
    updateData.care_level = payload.care_level
  }

  if (payload.notes !== undefined) {
    updateData.notes = payload.notes
  }

  if (payload.is_zsn !== undefined) {
    updateData.is_zsn = payload.is_zsn
  }

  if (payload.birth_date !== undefined) {
    updateData.birth_date = payload.birth_date
  }

  if (payload.admission_date !== undefined) {
    updateData.admission_date = payload.admission_date
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Brak pól do zaktualizowania.' }
  }

  const { error: updateErr } = await adminClient
    .from('residents')
    .update(updateData)
    .eq('id', payload.residentId)

  if (updateErr) {
    return { success: false, error: `Błąd zapisu danych: ${updateErr.message}` }
  }

  // Rejestracja w audit_logs
  await adminClient.from('audit_logs').insert({
    organization_id: resident.organization_id,
    user_id: user.id,
    action: 'RESIDENT_INLINE_UPDATE',
    target_table: 'residents',
    target_id: payload.residentId,
    details: {
      updated_fields: Object.keys(updateData),
      changes: updateData,
    },
  })

  revalidatePath('/admin/residents')

  return {
    success: true,
    data: updateData as Partial<UpdateResidentPayload>,
  }
}
