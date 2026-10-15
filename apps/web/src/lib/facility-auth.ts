import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function requireOrgAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) throw new Error('Brak przypisanej placówki')
  const role = user.app_metadata?.role as string | undefined
  if (!['org_admin', 'super_admin', 'admin'].includes(role || '')) {
    throw new Error('Brak uprawnień administratora placówki')
  }
  return { user, orgId, supabase, adminClient: createAdminClient() }
}
