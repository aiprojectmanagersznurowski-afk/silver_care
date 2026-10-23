'use client'

import { Copy, RotateCw, Ban } from 'lucide-react'
import { RowActions, type RowAction } from '@/components/patterns/RowActions'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { InvitationRecord } from './InvitationsTable'

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

/** Akcje zaproszenia w menu „⋯" — to samo w tabeli i w kafelku. */
export function InvitationRowActions({ inv, resending, onCopy, onResend, onRevoke }: InvitationRowActionsProps) {
  const { isPending, canCopy } = invitationState(inv)
  const actions: RowAction[] = [
    ...(canCopy ? [{ label: 'Kopiuj link', icon: Copy, hint: 'Kopiuj link do rejestracji', onSelect: () => onCopy(inv.id) }] : []),
    ...(isPending ? [
      { label: 'Ponów', icon: RotateCw, hint: 'Wyślij ponownie e-mail z zaproszeniem', disabled: resending, onSelect: () => onResend(inv.id) },
      { label: 'Odwołaj', icon: Ban, hint: 'Odwołaj zaproszenie', separated: true, onSelect: () => onRevoke(inv.id) },
    ] : []),
  ]
  // Zrealizowane i odwołane zaproszenia nie mają akcji — menu zostaje, żeby każdy wiersz wyglądał tak samo
  const fallback: RowAction[] = [{ label: 'Brak dostępnych akcji', disabled: true }]
  return <RowActions label="Zaproszenie" actions={actions.length ? actions : fallback} />
}
