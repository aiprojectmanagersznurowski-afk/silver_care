'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { InvitationRowActions, InvitationStatusBadge } from './InvitationRowActions'
import { roleLabel } from '@/lib/auth/role-labels'
import { formatPersonName, matchesPersonName } from '@/lib/person-name'

export interface InvitationRecord {
  id: string
  email: string
  phone?: string | null
  role: 'family' | 'legal_guardian'
  created_at: string
  expires_at: string
  claimed_at?: string | null
  revoked_at?: string | null
  residents?: {
    first_name: string
    last_name: string
  } | null
}

export function InvitationsTable({ initialInvitations }: { initialInvitations: InvitationRecord[] }) {
  const [allInvitations, setInvitations] = useState<InvitationRecord[]>(initialInvitations)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const invitations = allInvitations.filter((inv) =>
    inv.email.toLowerCase().includes(q) || matchesPersonName(inv.residents?.first_name, inv.residents?.last_name, q)
  )
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewPreference(VIEW_PREFERENCE_KEYS.invitations, 'table', ['table', 'grid'] as const)

  const handleCopyLink = (invitationId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/register?token=${invitationId}`
    navigator.clipboard.writeText(url)
    toast.success('Link zaproszenia został skopiowany do schowka.')
  }

  const handleResend = async (invitationId: string) => {
    setResendingId(invitationId)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invitationId, action: 'resend' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Wysłano ponownie e-mail z zaproszeniem.')
      } else {
        toast.error(data.error || 'Nie udało się wysłać zaproszenia ponownie.')
      }
    } catch {
      toast.error('Błąd połączenia z serwerem podczas ponawiania zaproszenia.')
    } finally {
      setResendingId(null)
    }
  }

  const handleConfirmRevoke = async () => {
    if (!revokingId) return
    setIsRevoking(true)
    try {
      const res = await fetch('/api/family/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revokingId, action: 'revoke' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Zaproszenie zostało pomyślnie odwołane.')
        setInvitations(prev =>
          prev.map(inv =>
            inv.id === revokingId ? { ...inv, revoked_at: new Date().toISOString() } : inv
          )
        )
      } else {
        toast.error(data.error || 'Nie udało się odwołać zaproszenia.')
      }
    } catch {
      toast.error('Błąd połączenia z serwerem podczas odwoływania zaproszenia.')
    } finally {
      setIsRevoking(false)
      setRevokingId(null)
    }
  }

  const rowActions = (inv: InvitationRecord) => (
    <InvitationRowActions inv={inv} resending={resendingId === inv.id} onCopy={handleCopyLink} onResend={handleResend} onRevoke={setRevokingId} />
  )

  return (
    <>
      <TableCard
        title="Oczekujące i zrealizowane zaproszenia"
        description="Rejestr zaproszeń, statusy oraz akcje zarządzania."
        toolbar={
          <ListToolbar end={<ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />}>
            <SearchField value={query} onChange={setQuery} label="Szukaj zaproszenia" placeholder="Szukaj po e-mailu lub podopiecznym..." />
          </ListToolbar>
        }
      >
      {viewMode === 'grid' ? (
        <div className="p-4">
          {invitations.length === 0 ? (
            <ListEmpty title="Brak zaproszeń" description="Zaproś bliskich podopiecznego przyciskiem u góry strony." />
          ) : (
            <ObjectGrid>
              {invitations.map((inv) => (
                <ObjectCard
                  key={inv.id}
                  title={inv.email}
                  subtitle={inv.phone ?? undefined}
                  badges={<InvitationStatusBadge inv={inv} />}
                  meta={[
                    { label: 'Podopieczny', value: inv.residents ? formatPersonName(inv.residents.first_name, inv.residents.last_name) : '—' },
                    { label: 'Rola', value: roleLabel(inv.role) },
                  ]}
                  actions={rowActions(inv)}
                />
              ))}
            </ObjectGrid>
          )}
        </div>
      ) : (
      <Table>
        <TableHeader className="[&_tr]:border-b">
          <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted">
            <TableHead className="text-muted-foreground">Email zapraszanego</TableHead>
            <TableHead className="text-muted-foreground">Podopieczny</TableHead>
            <TableHead className="text-muted-foreground">Rola</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-right text-muted-foreground">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {invitations.map((inv) => {
            return (
              <TableRow key={inv.id} className="hover:bg-muted/50 data-[state=selected]:bg-muted">
                <TableCell className="font-medium text-foreground">
                  {inv.email}
                  {inv.phone && <span className="ml-2 text-sm text-muted-foreground font-normal">{inv.phone}</span>}
                </TableCell>
                <TableCell className="text-foreground">
                  {inv.residents ? formatPersonName(inv.residents.first_name, inv.residents.last_name) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {roleLabel(inv.role)}
                </TableCell>
                <TableCell>
                  <InvitationStatusBadge inv={inv} />
                </TableCell>
                <TableCell className="text-right">{rowActions(inv)}</TableCell>
              </TableRow>
            )
          })}
          {invitations.length === 0 && (
            <TableStateRow colSpan={5} state="empty" title="Brak zaproszeń" description="Zaproś bliskich podopiecznego przyciskiem u góry strony." />
          )}
        </TableBody>
      </Table>
      )}
      </TableCard>

      <ConfirmDialog
        open={!!revokingId}
        onOpenChange={(open) => !open && setRevokingId(null)}
        title="Odwołaj zaproszenie"
        description="Czy na pewno chcesz unieważnić to zaproszenie? Wygenerowany link i token rejestracyjny przestaną działać."
        confirmLabel="Odwołaj zaproszenie"
        cancelLabel="Anuluj"
        variant="destructive"
        loading={isRevoking}
        onConfirm={handleConfirmRevoke}
      />
    </>
  )
}
