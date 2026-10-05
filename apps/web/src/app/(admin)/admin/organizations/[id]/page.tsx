export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, ArrowLeft, Users, UserCog, UserCheck, Calendar, MapPin, Mail, ShieldAlert } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { startImpersonationAction } from '@/actions/impersonation'
import { ResendAdminInviteButton, AddAdminToOrgDialog } from '@/components/AdminInviteActions'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user?.app_metadata?.role || user?.user_metadata?.role

  if (role !== 'super_admin') {
    redirect('/admin')
  }

  // 1. Pobierz placówkę
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (orgError || !organization) {
    notFound()
  }

  // 2. Pobierz liczbę pensjonariuszy (agregacja COUNT — zero PII)
  const adminClient = createAdminClient()
  const { count: activeResidentCount } = await adminClient
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id)
    .is('archived_at', null)

  // 3. Pobierz konta powiązane z tą organizacją
  const { data: usersData } = await adminClient.auth.admin.listUsers()

  const orgUsers = (usersData?.users || []).filter(u =>
    u.app_metadata?.organization_id === id || u.user_metadata?.organization_id === id
  )

  const administrators = orgUsers.filter(u =>
    u.app_metadata?.role === 'org_admin' || u.user_metadata?.role === 'org_admin'
  )

  const staff = orgUsers.filter(u =>
    u.app_metadata?.role !== 'org_admin' && u.user_metadata?.role !== 'org_admin'
  )

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/organizations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do listy placówek
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
                {organization.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span>{organization.address || 'Brak adresu'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditOrganizationDialog
              organization={{
                organization_id: organization.id,
                organization_name: organization.name,
                address: organization.address,
                resident_limit: organization.resident_limit || 50,
              }}
            />
            <BusinessIdBadge type="organization" id={organization.id} />
          </div>
        </div>
      </div>

      {/* Karty KPI placówki */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Aktywni podopieczni</p>
                <div className="text-xl font-bold text-foreground">
                  {activeResidentCount || 0}
                  <span className="text-sm font-normal text-muted-foreground"> / {organization.resident_limit || 50}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Administratorzy placówki</p>
                <div className="text-xl font-bold text-foreground">
                  {administrators.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Personel opiekuńczy</p>
                <div className="text-xl font-bold text-foreground">
                  {staff.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sekcja Administratorzy */}
      <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
        <CardHeader className="border-b border-border bg-card px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <UserCog className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Administratorzy Ośrodka (org_admin)</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                Konta posiadające uprawnienia do zarządzania personelem, podopiecznymi i salami w tej placówce.
              </CardDescription>
            </div>
            <AddAdminToOrgDialog
              organizationId={organization.id}
              organizationName={organization.name}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Użytkownik</TableHead>
                  <TableHead scope="col">Rola</TableHead>
                  <TableHead scope="col">Data rejestracji</TableHead>
                  <TableHead scope="col">Ostatnie logowanie</TableHead>
                  <TableHead scope="col" className="text-right">Akcja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {administrators.map(admin => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{admin.email}</div>
                      <div className="font-mono text-xs text-muted-foreground">{admin.id}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        Administrator Ośrodka
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(admin.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.last_sign_in_at
                        ? new Date(admin.last_sign_in_at).toLocaleString('pl-PL')
                        : 'Nigdy'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ResendAdminInviteButton
                          adminEmail={admin.email || ''}
                          organizationId={organization.id}
                          organizationName={organization.name}
                        />
                        <form action={startImpersonationAction}>
                          <input type="hidden" name="targetAdminId" value={admin.id} />
                          <input type="hidden" name="targetOrgId" value={organization.id} />
                          <input type="hidden" name="targetOrgName" value={organization.name} />
                          <input type="hidden" name="adminEmail" value={admin.email || ''} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-border bg-muted text-foreground hover:bg-muted text-xs h-9 font-medium"
                            title="Zaloguj jako ten administrator placówki"
                          >
                            Zaloguj jako
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {administrators.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Brak przypisanych administratorów placówki.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja Personel */}
      <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
        <CardHeader className="border-b border-border bg-card px-6 py-5">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <UserCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Personel Opiekuńczy</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Lista personelu i opiekunów przypisanych do tej placówki (wyłącznie dane techniczne kont).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Użytkownik</TableHead>
                  <TableHead scope="col">Rola</TableHead>
                  <TableHead scope="col">Data rejestracji</TableHead>
                  <TableHead scope="col">Ostatnie logowanie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map(person => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{person.email}</div>
                      <div className="font-mono text-xs text-muted-foreground">{person.id}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {person.app_metadata?.role || person.user_metadata?.role || 'Personel'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(person.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.last_sign_in_at
                        ? new Date(person.last_sign_in_at).toLocaleString('pl-PL')
                        : 'Nigdy'
                      }
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Brak zarejestrowanego personelu w tej placówce.
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
