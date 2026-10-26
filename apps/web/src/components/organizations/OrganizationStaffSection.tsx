import { TableStateRow } from '@/components/patterns/TableCard'
import { ListViewFrame } from '@/components/patterns/ListViewFrame'
import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { UserCheck } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { User } from '@supabase/supabase-js'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { getAppRole } from '@/lib/auth/app-role'

interface OrganizationStaffSectionProps {
  staff: User[]
}

const roleOf = (person: User) =>
  getAppRole(person) ?? 'Personel'
const lastSignIn = (person: User) =>
  person.last_sign_in_at ? new Date(person.last_sign_in_at).toLocaleString('pl-PL') : 'Nigdy'
const EMPTY_TITLE = 'Brak zarejestrowanego personelu w tej placówce'

export function OrganizationStaffSection({ staff }: OrganizationStaffSectionProps) {
  const grid = staff.length === 0 ? (
    <ListEmpty title={EMPTY_TITLE} />
  ) : (
    <ObjectGrid>
      {staff.map((person) => (
        <ObjectCard
          key={person.id}
          title={person.email}
          badges={<StatusBadge>{roleOf(person)}</StatusBadge>}
          meta={[
            { label: 'Identyfikator', value: <BusinessIdBadge type="user" id={person.id} /> },
            { label: 'Data rejestracji', value: new Date(person.created_at).toLocaleDateString('pl-PL') },
            { label: 'Ostatnie logowanie', value: lastSignIn(person) },
          ]}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(person => (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{person.email}</div>
                      <BusinessIdBadge type="user" id={person.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>{roleOf(person)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(person.created_at).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lastSignIn(person)}
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableStateRow colSpan={4} state="empty" title={EMPTY_TITLE} />
              )}
            </TableBody>
          </Table>
  )

  return (
    <ListViewFrame
      storageKey={VIEW_PREFERENCE_KEYS.orgStaff}
      icon={<UserCheck />}
      title="Personel opiekuńczy"
      description="Lista personelu i opiekunów przypisanych do tej placówki (wyłącznie dane techniczne kont)."
      table={table}
      grid={grid}
    />
  )
}
