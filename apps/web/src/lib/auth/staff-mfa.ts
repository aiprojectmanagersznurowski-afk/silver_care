import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/** @REQ: SEC-MFA-STAFF */
export async function staffMfaSatisfied(
  supabase: Pick<SupabaseClient<Database>, 'rpc'>,
  level: unknown,
  requiredLevel = 'aal2',
): Promise<boolean> {
  if (level === requiredLevel) return true
  const { data, error } = await supabase.rpc('staff_mfa_satisfied')
  return !error && data === true
}
