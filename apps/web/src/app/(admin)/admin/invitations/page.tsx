import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { InviteFamilyDialog } from '@/components/InviteFamilyDialog'
import { redirect } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
          <p className="text-text-secondary">Zarządzaj dostępem dla bliskich pensjonariuszy.</p>
        </div>
        <InviteFamilyDialog residents={residents || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oczekujące i zrealizowane zaproszenia</CardTitle>
          <CardDescription>Rejestr zaproszeń i powiązań.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="[&_tr]:border-b">
                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <TableHead className="h-12 text-text-secondary">Email zapraszanego</TableHead>
                  <TableHead className="h-12 text-text-secondary">Pensjonariusz</TableHead>
                  <TableHead className="h-12 text-text-secondary">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-0">
                {invitations?.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <TableCell className="font-medium">
                      {inv.email}
                    </TableCell>
                    <TableCell>
                      {inv.residents?.first_name} {inv.residents?.last_name}
                    </TableCell>
                    <TableCell>
                      {inv.claimed_at ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">
                          Zrealizowane
                        </span>
                      ) : inv.revoked_at ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive">
                          Odwołane
                        </span>
                      ) : new Date(inv.expires_at) < new Date() ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive">
                          Wygasłe
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                          Oczekujące
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!invitations || invitations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-text-secondary">
                      Brak zaproszeń w bazie.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
