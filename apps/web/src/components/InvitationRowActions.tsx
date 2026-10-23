'use client'

import { Copy, RotateCw, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { InvitationRecord } from './InvitationsTable'

const ACTION = 'min-h-touch px-2 text-sm text-foreground hover:bg-muted'

export const invitationState = (inv: InvitationRecord) => ({
  isPending: !inv.claimed_at && !inv.revoked_at && new Date(inv.expires_at) >= new Date(),
  canCopy: !inv.claimed_at && !inv.revoked_at,
})

export function InvitationStatusBadge({ inv }: { inv: InvitationRecord }) {
  if (inv.claimed_at) return <StatusBadge tone="brand">Zrealizowane</StatusBadge>
  if (inv.revoked_at) return <StatusBadge>Odwołane</StatusBadge>
  if (new Date(inv.expires_at) < new Date()) return <StatusBadge>Wygasłe</StatusBadge>
  return <StatusBadge>Oczekujące</StatusBadge>
}

interface InvitationRowActionsProps {
  inv: InvitationRecord
  resending: boolean
  onCopy: (id: string) => void
  onResend: (id: string) => void
  onRevoke: (id: string) => void
}

/** Akcje zaproszenia — ten sam rozmiar i styl w tabeli i w kafelku. */
export function InvitationRowActions({ inv, resending, onCopy, onResend, onRevoke }: InvitationRowActionsProps) {
  const { isPending, canCopy } = invitationState(inv)
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canCopy && (
        <Button type="button" variant="ghost" onClick={() => onCopy(inv.id)} className={ACTION} title="Kopiuj link do rejestracji">
          <Copy className="size-4" />
          Kopiuj link
        </Button>
      )}
      {isPending && (
        <Button type="button" variant="ghost" disabled={resending} onClick={() => onResend(inv.id)} className={ACTION} title="Wyślij ponownie e-mail z zaproszeniem">
          <RotateCw className={`size-4 ${resending ? 'animate-spin' : ''}`} />
          Ponów
        </Button>
      )}
      {isPending && (
        <Button type="button" variant="ghost" onClick={() => onRevoke(inv.id)} className={ACTION} title="Odwołaj zaproszenie">
          <Ban className="size-4" />
          Odwołaj
        </Button>
      )}
    </div>
  )
}
