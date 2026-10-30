import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Personel placówki do wyboru w grafiku (NUR-SHIFT-LEAD). Lista kont jest dostępna tylko po stronie serwera;
 * rola i placówka wyłącznie z app_metadata. Do przeglądarki trafiają tylko id, nazwa wyświetlana i rola.
 */
export interface ShiftStaffOption {
  id: string
  label: string
  role: 'nurse' | 'org_admin'
}

export async function listShiftStaff(orgId: string): Promise<ShiftStaffOption[]> {
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    console.error('[SHIFT_STAFF_LIST_FAIL]', error.status)
    return []
  }
  return data.users
    .filter((u) => u.app_metadata?.organization_id === orgId && u.app_metadata?.is_active !== false)
    .filter((u) => u.app_metadata?.role === 'nurse' || u.app_metadata?.role === 'org_admin')
    .map((u) => ({
      id: u.id,
      label: (u.user_metadata?.full_name as string | undefined)?.trim() || u.email || 'Bez nazwy',
      role: u.app_metadata?.role as 'nurse' | 'org_admin',
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))
}
