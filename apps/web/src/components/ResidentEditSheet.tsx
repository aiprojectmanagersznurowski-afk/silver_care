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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateResidentInlineAction } from '@/actions/resident-inline'
import { Pencil, Loader2, AlertCircle, Check } from 'lucide-react'
import { CareLevel } from '@/lib/reporting-constants'

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

  const [formData, setFormData] = useState({
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
        className="p-2 rounded-lg text-slate-soft/70 hover:text-slate hover:bg-slate/5 focus:outline-none focus:ring-2 focus:ring-sage/50 min-h-[48px] min-w-[48px] inline-flex items-center justify-center transition-colors"
        title={`Edytuj dane: ${resident.first_name} ${resident.last_name}`}
        aria-label={`Edytuj dane podopiecznego ${resident.first_name} ${resident.last_name}`}
        data-testid="resident-edit-btn"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <SheetHeader className="p-0 mb-6">
              <SheetTitle className="text-xl font-display font-semibold text-slate">
                Szybka edycja podopiecznego
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-soft">
                Wprowadź zmiany w profilu podopiecznego. Zmiany zostaną natychmiast odnotowane w rejestrze audytowym placówki.
              </SheetDescription>
            </SheetHeader>

            <form id="resident-edit-form" onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg"
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Zmiany zostały pomyślnie zapisane!</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-xs font-medium text-slate">
                  Imię *
                </Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-xs font-medium text-slate">
                  Nazwisko *
                </Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="birth_date" className="text-xs font-medium text-slate">
                    Data urodzenia
                  </Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admission_date" className="text-xs font-medium text-slate">
                    Data przyjęcia
                  </Label>
                  <Input
                    id="admission_date"
                    type="date"
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="care_level" className="text-xs font-medium text-slate">
                  Poziom opieki
                </Label>
                <select
                  id="care_level"
                  value={formData.care_level}
                  onChange={(e) => setFormData({ ...formData, care_level: e.target.value })}
                  className="w-full rounded-md border border-slate/20 bg-white px-3 py-2 text-sm text-slate focus:outline-none focus:ring-2 focus:ring-sage/50 min-h-[44px]"
                >
                  <option value="">Nieokreślony</option>
                  <option value="walking">Chodzący</option>
                  <option value="sitting">Siedzący</option>
                  <option value="bedridden">Leżący</option>
                  <option value="hospice">Opieka paliatywna</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-medium text-slate">
                  Notatki / uwagi organizacyjne
                </Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-slate/20 bg-white p-3 text-sm text-slate focus:outline-none focus:ring-2 focus:ring-sage/50"
                  placeholder="Wpisz istotne informacje organizacyjne..."
                />
              </div>
            </form>
          </div>

          <SheetFooter className="p-0 pt-6 mt-6 border-t border-slate/10 flex sm:flex-row justify-end gap-2">
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
              className="bg-sage hover:bg-sage/90 text-white min-h-[44px] min-w-[120px]"
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
