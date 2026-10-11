'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Copy, RotateCw, Ban } from 'lucide-react'
import { toast } from 'sonner'

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
  const [invitations, setInvitations] = useState<InvitationRecord[]>(initialInvitations)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

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

  const getStatusBadge = (inv: InvitationRecord) => {
    if (inv.claimed_at) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">
          Zrealizowane
        </span>
      )
    }
    if (inv.revoked_at) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive border-destructive/20">
          Odwołane
        </span>
      )
    }
    if (new Date(inv.expires_at) < new Date()) {
      return (
        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">
          Wygasłe
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">
        Oczekujące
      </span>
    )
  }

  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader className="[&_tr]:border-b">
          <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted">
            <TableHead className="h-12 text-muted-foreground">Email zapraszanego</TableHead>
            <TableHead className="h-12 text-muted-foreground">Podopieczny</TableHead>
            <TableHead className="h-12 text-muted-foreground">Rola</TableHead>
            <TableHead className="h-12 text-muted-foreground">Status</TableHead>
            <TableHead className="h-12 text-right text-muted-foreground">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-0">
          {invitations.map((inv) => {
            const isPending = !inv.claimed_at && !inv.revoked_at && new Date(inv.expires_at) >= new Date()
            const canCopy = !inv.claimed_at && !inv.revoked_at

            return (
              <TableRow key={inv.id} className="hover:bg-muted/50 data-[state=selected]:bg-muted">
                <TableCell className="font-medium text-foreground">
                  {inv.email}
                  {inv.phone && <span className="block text-xs text-muted-foreground font-normal">{inv.phone}</span>}
                </TableCell>
                <TableCell className="text-foreground">
                  {inv.residents ? `${inv.residents.first_name} ${inv.residents.last_name}` : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {inv.role === 'legal_guardian' ? 'Opiekun prawny' : 'Obserwator'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(inv)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canCopy && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(inv.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        title="Kopiuj link do rejestracji"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Kopiuj link
                      </Button>
                    )}
                    {isPending && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={resendingId === inv.id}
                        onClick={() => handleResend(inv.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        title="Wyślij ponownie e-mail z zaproszeniem"
                      >
                        <RotateCw className={`h-3.5 w-3.5 mr-1 ${resendingId === inv.id ? 'animate-spin' : ''}`} />
                        Ponów
                      </Button>
                    )}
                    {isPending && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokingId(inv.id)}
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                        title="Odwołaj zaproszenie"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Odwołaj
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {invitations.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Brak zaproszeń w bazie.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
    </div>
  )
}
