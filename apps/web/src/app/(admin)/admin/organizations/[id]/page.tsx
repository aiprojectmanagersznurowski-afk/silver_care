export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, ArrowLeft, Users, UserCog, UserCheck, Calendar, MapPin, Mail, ShieldAlert } from 'lucide-react'
import { startImpersonationAction } from '@/actions/impersonation'

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
          className="inline-flex items-center gap-2 text-sm text-slate-soft hover:text-slate transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do listy placówek
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage/10 text-sage">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
                {organization.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-slate-soft mt-1">
                <MapPin className="h-4 w-4" />
                <span>{organization.address || 'Brak adresu'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-soft bg-white px-3 py-1.5 rounded-xl border border-slate/10">
              ID: {organization.id}
            </span>
          </div>
        </div>
      </div>

      {/* Karty KPI placówki */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage/10 text-sage">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-soft font-medium">Aktywni podopieczni</p>
                <div className="text-xl font-bold text-slate">
                  {activeResidentCount || 0}
                  <span className="text-sm font-normal text-slate-soft"> / {organization.resident_limit || 50}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate/10 text-slate">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-soft font-medium">Administratorzy placówki</p>
                <div className="text-xl font-bold text-slate">
                  {administrators.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate/10 text-slate">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-soft font-medium">Personel opiekuńczy</p>
                <div className="text-xl font-bold text-slate">
                  {staff.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sekcja Administratorzy */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardHeader className="border-b border-slate/5 bg-white px-6 py-5">
          <div className="flex items-center gap-2 text-slate font-semibold">
            <UserCog className="h-5 w-5 text-sage" />
            <CardTitle className="text-lg">Administratorzy Ośrodka (org_admin)</CardTitle>
          </div>
          <CardDescription className="text-slate-soft">
            Konta posiadające uprawnienia do zarządzania personelem, podopiecznymi i salami w tej placówce.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th scope="col" className="px-6 py-4 font-medium">Użytkownik</th>
                  <th scope="col" className="px-6 py-4 font-medium">Rola</th>
                  <th scope="col" className="px-6 py-4 font-medium">Data rejestracji</th>
                  <th scope="col" className="px-6 py-4 font-medium">Ostatnie logowanie</th>
                  <th scope="col" className="px-6 py-4 font-medium text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {administrators.map(admin => (
                  <tr key={admin.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate">{admin.email}</div>
                      <div className="font-mono text-xs text-slate-soft">{admin.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-sage/10 px-2.5 py-1 text-xs font-semibold text-sage">
                        Administrator Ośrodka
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {new Date(admin.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {admin.last_sign_in_at
                        ? new Date(admin.last_sign_in_at).toLocaleString('pl-PL')
                        : 'Nigdy'
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={startImpersonationAction}>
                        <input type="hidden" name="targetAdminId" value={admin.id} />
                        <input type="hidden" name="targetOrgId" value={organization.id} />
                        <input type="hidden" name="targetOrgName" value={organization.name} />
                        <input type="hidden" name="adminEmail" value={admin.email || ''} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs h-9 font-medium"
                          title="Zaloguj jako ten administrator placówki"
                        >
                          Zaloguj jako
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {administrators.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-soft">
                      Brak przypisanych administratorów placówki.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja Personel */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardHeader className="border-b border-slate/5 bg-white px-6 py-5">
          <div className="flex items-center gap-2 text-slate font-semibold">
            <UserCheck className="h-5 w-5 text-sage" />
            <CardTitle className="text-lg">Personel Opiekuńczy</CardTitle>
          </div>
          <CardDescription className="text-slate-soft">
            Lista personelu i opiekunów przypisanych do tej placówki (wyłącznie dane techniczne kont).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th scope="col" className="px-6 py-4 font-medium">Użytkownik</th>
                  <th scope="col" className="px-6 py-4 font-medium">Rola</th>
                  <th scope="col" className="px-6 py-4 font-medium">Data rejestracji</th>
                  <th scope="col" className="px-6 py-4 font-medium">Ostatnie logowanie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {staff.map(person => (
                  <tr key={person.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate">{person.email}</div>
                      <div className="font-mono text-xs text-slate-soft">{person.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate/10 px-2.5 py-1 text-xs font-medium text-slate">
                        {person.app_metadata?.role || person.user_metadata?.role || 'Personel'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {new Date(person.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {person.last_sign_in_at
                        ? new Date(person.last_sign_in_at).toLocaleString('pl-PL')
                        : 'Nigdy'
                      }
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-soft">
                      Brak zarejestrowanego personelu w tej placówce.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
