'use client'

import React, { useState, useTransition } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { updateResidentInlineAction } from '@/actions/resident-inline'
import { Pencil, Loader2, AlertCircle, Check } from 'lucide-react'
import { CareLevel } from '@/lib/reporting-constants'
import {
  ResidentEditSheetFormFields,
  type ResidentEditSheetFormData,
} from './residents/ResidentEditSheetFormFields'

interface ResidentData {
  id: string
  first_name: string
  last_name: string
  birth_date?: string | null
  admission_date?: string | null
  care_level?: CareLevel | null
  notes?: string | null
  is_zsn?: boolean
}

interface ResidentEditSheetProps {
  resident: ResidentData
  onUpdated?: (updated: Partial<ResidentData>) => void
}

export function ResidentEditSheet({ resident, onUpdated }: ResidentEditSheetProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState(false)

  const [formData, setFormData] = useState<ResidentEditSheetFormData>({
    first_name: resident.first_name,
    last_name: resident.last_name,
    birth_date: resident.birth_date ? resident.birth_date.substring(0, 10) : '',
    admission_date: resident.admission_date ? resident.admission_date.substring(0, 10) : '',
    care_level: (resident.care_level || '') as string,
    notes: resident.notes || '',
  })

  const handleOpen = () => {
    setFormData({
      first_name: resident.first_name,
      last_name: resident.last_name,
      birth_date: resident.birth_date ? resident.birth_date.substring(0, 10) : '',
      admission_date: resident.admission_date ? resident.admission_date.substring(0, 10) : '',
      care_level: (resident.care_level || '') as string,
      notes: resident.notes || '',
    })
    setErrorMessage(null)
    setSuccessMessage(false)
    setOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!formData.first_name.trim()) {
      setErrorMessage('Imię jest wymagane.')
      return
    }

    if (!formData.last_name.trim()) {
      setErrorMessage('Nazwisko jest wymagane.')
      return
    }

    const payload = {
      residentId: resident.id,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      birth_date: formData.birth_date || null,
      admission_date: formData.admission_date || null,
      care_level: (formData.care_level ? formData.care_level : null) as CareLevel | null,
      notes: formData.notes.trim() || null,
    }

    startTransition(async () => {
      try {
        const res = await updateResidentInlineAction(payload)
        if (!res.success) {
          setErrorMessage(res.error || 'Nie udało się zapisać zmian.')
        } else {
          setSuccessMessage(true)
          onUpdated?.(payload)
          setTimeout(() => {
            setOpen(false)
            setSuccessMessage(false)
          }, 800)
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Błąd połączenia z serwerem.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-2 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px] min-w-[48px] inline-flex items-center justify-center transition-colors"
        title={`Edytuj dane: ${resident.first_name} ${resident.last_name}`}
        aria-label={`Edytuj dane podopiecznego ${resident.first_name} ${resident.last_name}`}
        data-testid="resident-edit-btn"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg md:max-w-xl p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <SheetHeader className="p-0 mb-6">
              <SheetTitle className="text-xl font-display font-semibold text-foreground">
                Szybka edycja podopiecznego
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Wprowadź zmiany w profilu podopiecznego. Zmiany zostaną natychmiast odnotowane w rejestrze audytowym placówki.
              </SheetDescription>
            </SheetHeader>

            <form id="resident-edit-form" onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-3 text-sm text-foreground bg-muted border border-border rounded-lg"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Zmiany zostały pomyślnie zapisane!</span>
                </div>
              )}

              <ResidentEditSheetFormFields formData={formData} setFormData={setFormData} />
            </form>
          </div>

          <SheetFooter className="p-0 pt-6 mt-6 border-t border-border flex sm:flex-row justify-end gap-2">
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
              form="resident-edit-form"
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-white min-h-[44px] min-w-[120px]"
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
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
