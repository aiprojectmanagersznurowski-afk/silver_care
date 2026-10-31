'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Clock, Users, X, AlertCircle, EyeOff } from 'lucide-react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ITEM_TYPES, ResidentSummary } from './agenda-types'
import { formatPersonName } from '@/lib/person-name'
import { isMedicalAgendaItem } from '@/lib/agenda-family-visibility'

interface AgendaAddFormProps {
  residents: ResidentSummary[]
  onAdd: (data: {
    title: string
    time: string
    type: string
    resident_id: string | null
    target_dates: string[]
  }) => Promise<boolean>
}

export function AgendaAddForm({ residents, onAdd }: AgendaAddFormProps) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('meal')
  // FAM-AGENDA-NO-MEDICAL: ta sama reguła co baza (family_visible)
  const hiddenFromFamily = isMedicalAgendaItem({ title, type })
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [isRecurring, setIsRecurring] = useState(true)
  const [itemDates, setItemDates] = useState<string[]>([new Date().toISOString().slice(0, 10)])
  const [currentDateInput, setCurrentDateInput] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !time || !type) {
      setFormError('Wypełnij wszystkie wymagane pola.')
      return
    }
    if (!isRecurring && itemDates.length === 0) {
      setFormError('Wybierz przynajmniej jedną datę.')
      return
    }

    setSubmitting(true)
    try {
      const ok = await onAdd({
        title: title.trim(),
        time,
        type,
        resident_id: selectedResidentId || null,
        target_dates: isRecurring ? [] : itemDates,
      })
      if (ok) {
        setTitle('')
        setTime('')
        setType('meal')
        setSelectedResidentId('')
        setItemDates([new Date().toISOString().slice(0, 10)])
      }
    } catch {
      setFormError('Błąd połączenia z serwerem.')
    } finally {
      setSubmitting(false)
    }
  }

  const addDate = () => {
    if (currentDateInput && !itemDates.includes(currentDateInput)) {
      setItemDates([...itemDates, currentDateInput].sort())
    }
  }

  const removeDate = (d: string) => {
    setItemDates(itemDates.filter((item) => item !== d))
  }

  return (
    <Card>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Nowy wpis w agendzie
        </h3>
      </div>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="agenda-title" className="text-sm font-medium text-foreground">
              Tytuł wydarzenia *
            </label>
            <input
              id="agenda-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Np. Podwieczorek i herbata"
              required
              aria-describedby={hiddenFromFamily ? 'agenda-family-hidden-hint' : undefined}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
            />
            {hiddenFromFamily && (
              <p id="agenda-family-hidden-hint" data-testid="agenda-family-hidden-hint" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Ten wpis nie będzie widoczny dla rodziny (treść medyczna).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="agenda-time" className="text-sm font-medium text-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Godzina *
              </label>
              <input
                id="agenda-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="agenda-type" className="text-sm font-medium text-foreground">
                Typ *
              </label>
              <NativeSelect
                id="agenda-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full min-h-touch"
              >
                {ITEM_TYPES.map((t) => (
                  <NativeSelectOption key={t.value} value={t.value}>{t.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="agenda-resident" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" /> Przypisanie
            </label>
            <NativeSelect
              id="agenda-resident"
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="w-full min-h-touch"
            >
              <NativeSelectOption value="">Wszyscy podopieczni (Cała placówka)</NativeSelectOption>
              {residents.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>{formatPersonName(r.first_name, r.last_name)}</NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">
              Zadanie ogólne lub skierowane do konkretnego podopiecznego.
            </p>
          </div>

          <div className="pt-3 border-t border-border">
            <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 block">
              Częstotliwość
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsRecurring(true)}
                className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all min-h-touch ${
                  isRecurring ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 ring-1 ring-border hover:bg-muted'
                }`}
              >
                <span className={`text-sm font-semibold ${isRecurring ? 'text-primary' : 'text-foreground'}`}>Codziennie</span>
                <span className="text-sm text-muted-foreground mt-0.5">Wszystkie dni</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRecurring(false)}
                className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all min-h-touch ${
                  !isRecurring ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 ring-1 ring-border hover:bg-muted'
                }`}
              >
                <span className={`text-sm font-semibold ${!isRecurring ? 'text-primary' : 'text-foreground'}`}>Jednorazowo</span>
                <span className="text-sm text-muted-foreground mt-0.5">Wybrane daty</span>
              </button>
            </div>
          </div>

          {!isRecurring && (
            <div className="space-y-3 bg-muted/50 p-3.5 rounded-xl ring-1 ring-border">
              <label htmlFor="agenda-date" className="text-sm font-medium text-foreground">Wybierz daty</label>
              <div className="flex gap-2">
                <input
                  id="agenda-date"
                  type="date"
                  value={currentDateInput}
                  onChange={(e) => setCurrentDateInput(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
                />
                <button
                  type="button"
                  onClick={addDate}
                  className="rounded-xl bg-card px-3 py-1.5 text-sm font-semibold text-foreground ring-1 ring-inset ring-border hover:bg-muted/50 transition-colors min-h-touch"
                >
                  Dodaj
                </button>
              </div>
              {itemDates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {itemDates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 bg-card border border-border text-sm font-medium text-foreground pl-2 pr-1 py-1 rounded-lg">
                      {new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                      <button type="button" onClick={() => removeDate(d)} className="text-muted-foreground hover:text-destructive rounded-md p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-destructive">Wybierz co najmniej jedną datę.</p>
              )}
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || (!isRecurring && itemDates.length === 0)}
            className="w-full mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-touch"
          >
            {submitting ? 'Dodawanie...' : 'Dodaj wpis do harmonogramu'}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
