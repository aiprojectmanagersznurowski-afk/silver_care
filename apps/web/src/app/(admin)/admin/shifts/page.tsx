import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppRole } from '@/lib/auth/app-role'
import { PageHeader } from '@/components/patterns/PageHeader'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddShiftDialog } from '@/components/shifts/AddShiftDialog'
import { ShiftActiveToggle } from '@/components/shifts/ShiftActiveToggle'
import { formatShiftRange, shiftCountMessage, trimSeconds } from '@/lib/shifts/shift-definitions'

export const dynamic = 'force-dynamic'

/**
 * Zmiany i grafik kierownika placówki (NUR-SHIFT-CONFIG, SC-NUR-12/AC1). Konfiguracja tylko dla kierownika placówki;
 * kontrakt nie daje tego zasobu administratorowi platformy ani bliskim.
 */
export default async function ShiftsPage() {
  const user = await getCurrentUser()
  if (!user || getAppRole(user) !== 'org_admin') redirect('/')

  const supabase = await createClient()
  const { data } = await supabase
    .from('shift_definitions')
    .select('id, name, code, start_time, end_time, is_active, order_index')
    .order('order_index', { ascending: true })

  const definitions = data ?? []
  const activeCount = definitions.filter((d) => d.is_active).length

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Zmiany i grafik"
        description="Zdefiniuj 2 albo 3 zmiany na dobę. Grafik personelu i kierowników zmian ułożysz w kolejnym kroku."
        actions={<AddShiftDialog />}
      />

      <TableCard
        title="Zmiany placówki"
        description={<span data-testid="shift-count-hint">{shiftCountMessage(activeCount)}</span>}
      >
        <Table aria-label="Zmiany placówki">
          <TableHeader className="text-muted-foreground">
            <TableRow>
              <TableHead>Zmiana</TableHead>
              <TableHead>Godziny</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40 text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.map((d) => (
              <TableRow key={d.id} data-testid="shift-definition-row">
                <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatShiftRange(trimSeconds(d.start_time), trimSeconds(d.end_time))}</TableCell>
                <TableCell>
                  <StatusBadge tone={d.is_active ? 'brand' : 'neutral'}>{d.is_active ? 'Aktywna' : 'Nieaktywna'}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <ShiftActiveToggle definitionId={d.id} isActive={d.is_active} />
                </TableCell>
              </TableRow>
            ))}
            {definitions.length === 0 && (
              <TableStateRow colSpan={4} state="empty" title="Brak zdefiniowanych zmian" description="Dodaj pierwszą zmianę przyciskiem u góry strony." />
            )}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  )
}
