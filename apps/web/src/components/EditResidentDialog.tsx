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
import { updateResidentInlineAction } from '@/actions/resident-inline'
import { updateResidentFundingAction } from '@/actions/resident-funding'
import { Pencil, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { CareLevel } from '@/lib/reporting-constants'
import { EditResidentFormFields, type EditResidentFormData } from './residents/EditResidentFormFields'
import { ResidentPhotoField } from './residents/ResidentPhotoField'

export interface EditResidentDialogProps {
  resident: {
    id: string
    first_name: string
    last_name: string
    birth_date?: string | null
    admission_date?: string | null
    care_level?: CareLevel | string | null
    gender?: 'M' | 'F' | string | null
    notes?: string | null
    is_zsn?: boolean
    contract_source?: string | null
    /** Osadzenie resident_funding z danych karty kierownika (SC-ADM-24). */
    resident_funding?: { funding_source: string | null } | { funding_source: string | null }[] | null
  }
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function EditResidentDialog({
  resident,
  trigger,
  onSuccess,
}: EditResidentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const funding = Array.isArray(resident.resident_funding) ? resident.resident_funding[0] : resident.resident_funding
  const initialFunding = funding?.funding_source || ''

  const [formData, setFormData] = useState<EditResidentFormData>({
    first_name: resident.first_name,
    last_name: resident.last_name,
    gender: (resident.gender || '') as string,
    birth_date: resident.birth_date ? resident.birth_date.substring(0, 10) : '',
    admission_date: resident.admission_date ? resident.admission_date.substring(0, 10) : '',
    care_level: (resident.care_level || '') as string,
    is_zsn: Boolean(resident.is_zsn),
    notes: resident.notes || '',
    contract_source: resident.contract_source || '',
    funding_source: initialFunding,
  })

  const resetForm = () => {
    setFormData({
      first_name: resident.first_name,
      last_name: resident.last_name,
      gender: (resident.gender || '') as string,
      birth_date: resident.birth_date ? resident.birth_date.substring(0, 10) : '',
      admission_date: resident.admission_date ? resident.admission_date.substring(0, 10) : '',
      care_level: (resident.care_level || '') as string,
      is_zsn: Boolean(resident.is_zsn),
      notes: resident.notes || '',
      contract_source: resident.contract_source || '',
      funding_source: initialFunding,
    })
    setErrorMessage(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      resetForm()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!formData.first_name.trim()) {
      setErrorMessage('Imię podopiecznego jest wymagane.')
      return
    }

    if (!formData.last_name.trim()) {
      setErrorMessage('Nazwisko podopiecznego jest wymagane.')
      return
    }

    const payload = {
      residentId: resident.id,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      gender: (formData.gender ? formData.gender : null) as 'M' | 'F' | null,
      birth_date: formData.birth_date || null,
      admission_date: formData.admission_date || null,
      care_level: (formData.care_level ? formData.care_level : null) as CareLevel | null,
      is_zsn: formData.is_zsn,
      notes: formData.notes.trim() || null,
      contract_source: formData.contract_source || null,
    }

    startTransition(async () => {
      try {
        const res = await updateResidentInlineAction(payload)
        // Źródło finansowania żyje w osobnej tabeli tylko dla kierownika (resident_funding) — osobny zapis z audytem
        const fundingRes = res.success && formData.funding_source && formData.funding_source !== initialFunding
          ? await updateResidentFundingAction(resident.id, formData.funding_source)
          : null
        if (!res.success) {
          setErrorMessage(res.error || 'Nie udało się zapisać zmian.')
        } else if (fundingRes && !fundingRes.success) {
          setErrorMessage(fundingRes.error || 'Nie udało się zapisać źródła finansowania.')
          router.refresh()
        } else {
          toast.success('Pomyślnie zaktualizowano dane podopiecznego')
          setOpen(false)
          onSuccess?.()
          router.refresh()
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Błąd połączenia z serwerem.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 text-sm"
          data-testid="edit-resident-btn"
        >
          <Pencil className="h-4 w-4" />
          Edytuj
        </Button>
      )} />

      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display font-semibold text-foreground">
            Edycja danych podopiecznego
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Wprowadź zmiany w profilu podopiecznego. Zmiany zostaną natychmiast odnotowane w rejestrze audytowym placówki.
          </DialogDescription>
        </DialogHeader>

        {/* Zdjęcie zapisuje się od razu po wybraniu pliku (prywatny bucket, SC-ADM-25) */}
        <ResidentPhotoField residentId={resident.id} />

        <form id="edit-resident-dialog-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <EditResidentFormFields formData={formData} setFormData={setFormData} fundingSet={Boolean(initialFunding)} />
        </form>

        <DialogFooter className="p-0 pt-4 border-t border-border flex sm:flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="min-h-touch"
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            form="edit-resident-dialog-form"
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-white min-h-touch min-w-[130px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              'Zapisz zmiany'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
