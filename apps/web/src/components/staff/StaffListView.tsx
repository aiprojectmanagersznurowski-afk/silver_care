'use client'

import { UserCog } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StaffActionsMenu } from '@/components/StaffActionsMenu'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'

export interface StaffListItem {
  id: string
  email: string
  isActive: boolean
  avatarUrl: string | null
  /** Sformatowane na serwerze, żeby uniknąć różnic strefy czasowej przy hydratacji. */
  lastSignInLabel: string
}

const ROLE_LABEL = 'Personel opiekuńczy / Wsparcie'
const EMPTY = { title: 'Brak przypisanego personelu', description: 'Zaproś pracowników za pomocą przycisku powyżej.' }
const ERROR = 'Lista personelu jest chwilowo niedostępna. Odśwież stronę za chwilę.'

function StaffAvatar({ item }: { item: StaffListItem }) {
  return (
    <Avatar className="h-10 w-10 border border-border">
      {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.email} />}
      <AvatarFallback className="bg-muted text-foreground">
        <UserCog className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  )
}

export function StaffListView({ staff, failed }: { staff: StaffListItem[]; failed: boolean }) {
  const [viewMode, setViewMode] = useViewPreference(VIEW_PREFERENCE_KEYS.staff, 'table', ['table', 'grid'] as const)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />
      </div>

      {viewMode === 'grid' ? (
        failed ? (
          <ListError description={ERROR} />
        ) : staff.length === 0 ? (
          <ListEmpty {...EMPTY} />
        ) : (
          <ObjectGrid>
            {staff.map((item) => (
              <ObjectCard
                key={item.id}
                title={item.email}
                subtitle={ROLE_LABEL}
                badges={!item.isActive ? <StatusBadge>Zarchiwizowany</StatusBadge> : undefined}
                meta={[{ label: 'Ostatnie logowanie', value: item.lastSignInLabel }]}
                actions={<StaffActionsMenu staffId={item.id} email={item.email} isActive={item.isActive} />}
              />
            ))}
          </ObjectGrid>
        )
      ) : (
        <TableCard>
          <Table>
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead>Pracownik</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Ostatnie logowanie</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <StaffAvatar item={item} />
                      <div>
                        <div className="font-medium text-foreground text-base">{item.email}</div>
                        {!item.isActive && <div className="mt-1"><StatusBadge>Zarchiwizowany</StatusBadge></div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{ROLE_LABEL}</TableCell>
                  <TableCell className="text-muted-foreground">{item.lastSignInLabel}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2 items-center">
                      <StaffActionsMenu staffId={item.id} email={item.email} isActive={item.isActive} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {failed ? (
                <TableStateRow colSpan={4} state="error" description={ERROR} />
              ) : staff.length === 0 && (
                <TableStateRow colSpan={4} state="empty" {...EMPTY} />
              )}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  )
}
