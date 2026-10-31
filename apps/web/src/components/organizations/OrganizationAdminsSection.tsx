import { TableStateRow } from '@/components/patterns/TableCard'
import { ListViewFrame } from '@/components/patterns/ListViewFrame'
import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { UserCog } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { AddAdminToOrgDialog } from '@/components/AdminInviteActions'
import { OrgAdminRowActions } from './OrgAdminRowActions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { User } from '@supabase/supabase-js'
import { StatusBadge } from '@/components/patterns/StatusBadge'

const lastSignIn = (u: User) => (u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('pl-PL') : 'Nigdy')
const EMPTY_TITLE = 'Brak przypisanych kierowników placówki'

interface OrganizationAdminsSectionProps {
  organizationId: string
  organizationName: string
  administrators: User[]
}

export function OrganizationAdminsSection({
  organizationId,
  organizationName,
  administrators
}: OrganizationAdminsSectionProps) {
  const actionsFor = (admin: User) => (
    <OrgAdminRowActions
      adminId={admin.id}
      adminEmail={admin.email || ''}
      organizationId={organizationId}
      organizationName={organizationName}
    />
  )

  const grid = administrators.length === 0 ? (
    <ListEmpty title={EMPTY_TITLE} />
  ) : (
    <ObjectGrid>
      {administrators.map((admin) => (
        <ObjectCard
          key={admin.id}
          title={admin.email}
          badges={<StatusBadge tone="brand">Kierownik placówki</StatusBadge>}
          meta={[
            { label: 'Identyfikator', value: <BusinessIdBadge type="user" id={admin.id} /> },
            { label: 'Data rejestracji', value: new Date(admin.created_at).toLocaleDateString('pl-PL') },
            { label: 'Ostatnie logowanie', value: lastSignIn(admin) },
          ]}
          actions={actionsFor(admin)}
        />
      ))}
    </ObjectGrid>
  )

  const table = (
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
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{admin.email}</div>
                      <BusinessIdBadge type="user" id={admin.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone="brand">Kierownik placówki</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lastSignIn(admin)}
                  </TableCell>
                  <TableCell className="text-right">
                    {actionsFor(admin)}
                  </TableCell>
                </TableRow>
              ))}
              {administrators.length === 0 && (
                <TableStateRow colSpan={5} state="empty" title={EMPTY_TITLE} />
              )}
            </TableBody>
          </Table>
  )

  return (
    <ListViewFrame
      storageKey={VIEW_PREFERENCE_KEYS.orgAdmins}
      icon={<UserCog />}
      title="Kierownicy placówki"
      description="Konta posiadające uprawnienia do zarządzania personelem, podopiecznymi i salami w tej placówce."
      actions={<AddAdminToOrgDialog organizationId={organizationId} organizationName={organizationName} />}
      table={table}
      grid={grid}
    />
  )
}
