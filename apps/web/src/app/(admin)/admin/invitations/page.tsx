import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { InviteFamilyDialog } from '@/components/InviteFamilyDialog'
import { InvitationsTable, type InvitationRecord } from '@/components/InvitationsTable'
import { redirect } from 'next/navigation'

export default async function AdminInvitationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  const orgId = user?.app_metadata?.organization_id

  if (!user || (role !== 'admin' && role !== 'org_admin' && role !== 'super_admin')) {
    redirect('/')
  }

  // Get residents for the dropdown
  let residentsQuery = supabase
    .from('residents')
    .select('id, first_name, last_name')
    .is('archived_at', null)

  // Get invitations
  let invitationsQuery = supabase
    .from('resident_invitations')
    .select(`
      *,
      residents (
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false })

  if (orgId) {
    residentsQuery = residentsQuery.eq('organization_id', orgId)
    invitationsQuery = invitationsQuery.eq('organization_id', orgId)
  }

  const { data: residents } = await residentsQuery
  const { data: invitations } = await invitationsQuery

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Zaproszenia
          </h2>
          <p className="text-muted-foreground">Zarządzaj dostępem dla bliskich podopiecznych.</p>
        </div>
        <InviteFamilyDialog residents={residents || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oczekujące i zrealizowane zaproszenia</CardTitle>
          <CardDescription>Rejestr zaproszeń, statusy oraz akcje zarządzania.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationsTable initialInvitations={(invitations as unknown as InvitationRecord[]) || []} />
        </CardContent>
      </Card>
    </div>
  )
}
