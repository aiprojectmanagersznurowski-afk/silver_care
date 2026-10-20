import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isImpersonationSessionActive, safeGetCookieStore } from '@/lib/impersonation-guards'

export async function requireOrgAdmin(options?: { allowImpersonation?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')

  if (!options?.allowImpersonation) {
    const cookieStore = await safeGetCookieStore()
    if (isImpersonationSessionActive(cookieStore, user)) {
      throw new Error('Operacja niedozwolona w trybie podglądu (impersonacji). Tryb jest ściśle Read-Only.')
    }
  }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) throw new Error('Brak przypisanej placówki')
  const role = user.app_metadata?.role as string | undefined
  if (!['org_admin', 'super_admin', 'admin'].includes(role || '')) {
    throw new Error('Brak uprawnień administratora placówki')
  }
  return { user, orgId, supabase, adminClient: createAdminClient() }
}
