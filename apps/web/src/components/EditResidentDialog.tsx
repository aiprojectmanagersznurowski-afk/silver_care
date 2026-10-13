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
import { updateResidentInlineAction } from '@/actions/resident-inline'
import { Pencil, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { CareLevel } from '@/lib/reporting-constants'

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

  const [formData, setFormData] = useState({
    first_name: resident.first_name,
    last_name: resident.last_name,
    gender: (resident.gender || '') as string,
    birth_date: resident.birth_date ? resident.birth_date.substring(0, 10) : '',
    admission_date: resident.admission_date ? resident.admission_date.substring(0, 10) : '',
    care_level: (resident.care_level || '') as string,
    is_zsn: Boolean(resident.is_zsn),
    notes: resident.notes || '',
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
    }

    startTransition(async () => {
      try {
        const res = await updateResidentInlineAction(payload)
        if (!res.success) {
          setErrorMessage(res.error || 'Nie udało się zapisać zmian.')
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

        <form id="edit-resident-dialog-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first-name" className="text-xs font-medium text-foreground">
                Imię *
              </Label>
              <Input
                id="edit-first-name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="min-h-[44px]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-last-name" className="text-xs font-medium text-foreground">
                Nazwisko *
              </Label>
              <Input
                id="edit-last-name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="min-h-[44px]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-gender" className="text-xs font-medium text-foreground">
                Płeć
              </Label>
              <NativeSelect
                id="edit-gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full min-h-[44px]"
              >
                <NativeSelectOption value="">Nieokreślona</NativeSelectOption>
                <NativeSelectOption value="F">Kobieta</NativeSelectOption>
                <NativeSelectOption value="M">Mężczyzna</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-birth-date" className="text-xs font-medium text-foreground">
                Data urodzenia
              </Label>
              <Input
                id="edit-birth-date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-admission-date" className="text-xs font-medium text-foreground">
                Data przyjęcia
              </Label>
              <Input
                id="edit-admission-date"
                type="date"
                value={formData.admission_date}
                onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                className="min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-care-level" className="text-xs font-medium text-foreground">
                Poziom opieki
              </Label>
              <NativeSelect
                id="edit-care-level"
                value={formData.care_level}
                onChange={(e) => setFormData({ ...formData, care_level: e.target.value })}
                className="w-full min-h-[44px]"
              >
                <NativeSelectOption value="">Nieokreślony</NativeSelectOption>
                <NativeSelectOption value="walking">Chodzący</NativeSelectOption>
                <NativeSelectOption value="sitting">Siedzący</NativeSelectOption>
                <NativeSelectOption value="bedridden">Leżący</NativeSelectOption>
                <NativeSelectOption value="hospice">Opieka paliatywna</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  id="edit-is-zsn"
                  checked={formData.is_zsn}
                  onChange={(e) => setFormData({ ...formData, is_zsn: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-foreground">
                  ZSN: Znaczny stopień niepełnosprawności
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-xs font-medium text-foreground">
              Notatki / uwagi organizacyjne
            </Label>
            <Textarea
              id="edit-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full"
              placeholder="Wpisz istotne informacje organizacyjne..."
            />
          </div>
        </form>

        <DialogFooter className="p-0 pt-4 border-t border-border flex sm:flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            form="edit-resident-dialog-form"
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-white min-h-[44px] min-w-[130px]"
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
