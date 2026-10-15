'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { dischargeResidentAction } from '@/actions/resident-lifecycle'
import {
  CONTRACT_END_REASONS,
  CONTRACT_END_REASON_LABELS,
  ContractEndReason,
} from '@/lib/reporting-constants'
import { LogOut, Loader2, AlertTriangle, BedDouble, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export interface DischargeResidentDialogProps {
  resident: {
    id: string
    first_name: string
    last_name: string
  }
  activeBedLabel?: string | null
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function DischargeResidentDialog({
  resident,
  activeBedLabel,
  trigger,
  onSuccess,
}: DischargeResidentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  const [contractEndDate, setContractEndDate] = useState(todayStr)
  const [contractEndReason, setContractEndReason] = useState<ContractEndReason>('family_request')
  const [deathDate, setDeathDate] = useState(todayStr)
  const [notes, setNotes] = useState('')

  const isDeath = contractEndReason === 'death'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    startTransition(async () => {
      try {
        const res = await dischargeResidentAction({
          residentId: resident.id,
          contractEndDate,
          contractEndReason,
          deathDate: isDeath ? deathDate : null,
          notes: notes.trim() || null,
        })

        if (!res.success) {
          setErrorMessage(res.error || 'Wystąpił błąd podczas rejestracji zakończenia pobytu.')
          toast.error(res.error || 'Błąd zapisu.')
          return
        }

        const successMsg = isDeath
          ? `Zarejestrowano zgon podopiecznego ${resident.first_name} ${resident.last_name}.`
          : `Zakończono pobyt podopiecznego ${resident.first_name} ${resident.last_name}.`

        toast.success(successMsg)
        if (res.unassignedBedLabel) {
          toast.info(`Zwolniono miejsce: ${res.unassignedBedLabel}`)
        }

        setOpen(false)
        router.refresh()
        onSuccess?.()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd.'
        setErrorMessage(msg)
        toast.error(msg)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Zakończ pobyt
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-destructive/10 text-destructive">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Zakończenie pobytu podopiecznego
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {resident.first_name} {resident.last_name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {errorMessage && (
            <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive flex items-start gap-2 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Podsumowanie konsekwencji operacji */}
          <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-sm text-foreground">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Konsekwencje formalne i zasobowe</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-sm">
              {activeBedLabel ? (
                <li className="flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>
                    Nastąpi natychmiastowe zwolnienie przypisanego miejsca:{' '}
                    <strong className="text-foreground">{activeBedLabel}</strong>.
                  </span>
                </li>
              ) : (
                <li>Podopieczny nie ma obecnie aktywnego przypisania do łóżka.</li>
              )}
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span>
                  <strong>Portal Rodziny:</strong> Bliscy zachowują dostęp do wglądu w dotychczasową historię (tryb tylko do odczytu).
                </span>
              </li>
              <li>
                Zdarzenie zostanie odnotowane w rejestrze statystyk placówki (BI) oraz audycie.
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Powód zakończenia pobytu */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="discharge-reason" className="text-sm font-semibold">
                Powód rozwiązania umowy / zakończenia pobytu *
              </Label>
              <NativeSelect
                id="discharge-reason"
                value={contractEndReason}
                onChange={(e) => setContractEndReason(e.target.value as ContractEndReason)}
                disabled={isPending}
                className="w-full"
              >
                {CONTRACT_END_REASONS.map((reasonKey) => (
                  <NativeSelectOption key={reasonKey} value={reasonKey}>
                    {CONTRACT_END_REASON_LABELS[reasonKey]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            {/* Data zakończenia umowy */}
            <div className="space-y-1.5">
              <Label htmlFor="contract-end-date" className="text-sm font-semibold">
                Data zakończenia umowy *
              </Label>
              <Input
                id="contract-end-date"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            {/* Data zgonu (tylko gdy powód to death) */}
            {isDeath ? (
              <div className="space-y-1.5">
                <Label htmlFor="death-date" className="text-sm font-semibold text-destructive">
                  Data zgonu *
                </Label>
                <Input
                  id="death-date"
                  type="date"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  disabled={isPending}
                  required
                  className="border-destructive/40"
                />
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}

            {/* Uwagi i notatka do rejestru */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="discharge-notes" className="text-sm font-semibold">
                Uwagi do rejestru placówki (opcjonalnie)
              </Label>
              <Textarea
                id="discharge-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodatkowe informacje dot. wypisu, protokołu zdawczo-odbiorczego lub rozliczeń..."
                disabled={isPending}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              variant={isDeath ? 'destructive' : 'default'}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeath ? 'Potwierdź rejestrację zgonu' : 'Zatwierdź zakończenie pobytu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
