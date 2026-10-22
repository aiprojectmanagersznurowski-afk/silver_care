import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { UserCheck } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { User } from '@supabase/supabase-js'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface OrganizationStaffSectionProps {
  staff: User[]
}

export function OrganizationStaffSection({ staff }: OrganizationStaffSectionProps) {
  return (
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
                    <div className="mt-1">
                      <BusinessIdBadge type="user" id={person.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>
                      {(person.app_metadata?.role as string) || (person.user_metadata?.role as string) || 'Personel'}
                    </StatusBadge>
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
  )
}
