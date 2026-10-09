'use client'

import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { parseNationalId, BedSuggestion } from '@/lib/admission-helpers'
import { getBedSuggestionsAction, admitResidentAction } from '@/actions/admission'
import { UserPlus, Sparkles, Bed, Check, AlertCircle, Loader2, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

type CareLevelType = 'walking' | 'sitting' | 'bedridden' | 'hospice'
type WizardStep = 1 | 2 | 3

export function AdmissionWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)

  // Krok 1: Dane podstawowe
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [idValue, setIdValue] = useState('')
  const [careLevel, setCareLevel] = useState<CareLevelType>('walking')
  const [isZsn, setIsZsn] = useState(false)
  const [notes, setNotes] = useState('')

  // Wyliczone z identyfikatora
  const [calculatedGender, setCalculatedGender] = useState<'M' | 'F' | null>(null)
  const [calculatedBirthDate, setCalculatedBirthDate] = useState<string | null>(null)
  const [idError, setIdError] = useState<string | null>(null)

  // Krok 2: Sugestie łóżek
  const [suggestions, setSuggestions] = useState<BedSuggestion[]>([])
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [selectedBedInfo, setSelectedBedInfo] = useState<string | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Statusy i błędy ogólne
  const [submitting, setSubmitting] = useState(false)
  const [createdResidentId, setCreatedResidentId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleIdChange = (val: string) => {
    setIdValue(val)
    if (val.length === 11) {
      const parsed = parseNationalId(val)
      if (parsed.valid && parsed.gender && parsed.birthDate) {
        setCalculatedGender(parsed.gender)
        setCalculatedBirthDate(parsed.birthDate)
        setIdError(null)
      } else {
        setCalculatedGender(null)
        setCalculatedBirthDate(null)
        setIdError(parsed.error || 'Nieprawidłowy identyfikator.')
      }
    } else {
      setCalculatedGender(null)
      setCalculatedBirthDate(null)
      setIdError(val.length > 0 ? 'Wprowadź pełne 11 cyfr.' : null)
    }
  }

  const handleFetchSuggestions = async () => {
    if (!calculatedGender) return
    setLoadingSuggestions(true)
    setStatusMessage(null)

    const res = await getBedSuggestionsAction(calculatedGender, careLevel)
    setLoadingSuggestions(false)

    if (res.error) {
      setStatusMessage({ type: 'error', text: res.error })
    } else if (res.suggestions) {
      setSuggestions(res.suggestions)
      if (res.suggestions.length > 0 && !selectedBedId) {
        setSelectedBedId(res.suggestions[0].bedId)
        setSelectedBedInfo(`Pokój ${res.suggestions[0].roomNumber} (piętro ${res.suggestions[0].floorNumber}), Łóżko ${res.suggestions[0].bedNumber}`)
      }
    }
  }

  const handleNextToStep2 = async () => {
    if (!firstName.trim() || !lastName.trim() || !calculatedGender) {
      setStatusMessage({ type: 'error', text: 'Uzupełnij wszystkie wymagane pola identyfikacyjne.' })
      return
    }
    setStatusMessage(null)
    setStep(2)
    await handleFetchSuggestions()
  }

  const handleNextToStep3 = () => {
    setStatusMessage(null)
    setStep(3)
  }

  const handlePrevStep = () => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  const handleSubmitAdmission = async () => {
    setSubmitting(true)
    setStatusMessage(null)

    const formData = new FormData()
    formData.append('firstName', firstName.trim())
    formData.append('lastName', lastName.trim())
    formData.append('nationalId', idValue.trim())
    formData.append('careLevel', careLevel)
    formData.append('isZsn', isZsn ? 'true' : 'false')
    if (selectedBedId) formData.append('bedId', selectedBedId)
    if (notes.trim()) formData.append('notes', notes.trim())

    const res = await admitResidentAction(formData)
    setSubmitting(false)

    if (res.error) {
      setStatusMessage({ type: 'error', text: res.error })
    } else {
      setCreatedResidentId(res.residentId || null)
      setStatusMessage({ type: 'success', text: res.message || 'Przyjęcie zakończone pomyślnie.' })
    }
  }

  const resetForm = () => {
    setStep(1)
    setFirstName('')
    setLastName('')
    setIdValue('')
    setCareLevel('walking')
    setIsZsn(false)
    setNotes('')
    setCalculatedGender(null)
    setCalculatedBirthDate(null)
    setIdError(null)
    setSuggestions([])
    setSelectedBedId(null)
    setSelectedBedInfo(null)
    setStatusMessage(null)
    setCreatedResidentId(null)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 text-white gap-2" />}>
        <UserPlus className="w-4 h-4" />
        Nowe Przyjęcie (Kreator)
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Przyjęcie podopiecznego — Krok {step} z 3
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Krok 1: Wprowadź dane osobowe i profil opiekuńczy podopiecznego.'}
            {step === 2 && 'Krok 2: Dobór pokoju i łóżka z uwzględnieniem płci i poziomu sprawności.'}
            {step === 3 && 'Krok 3: Podsumowanie danych i zatwierdzenie przyjęcia.'}
          </DialogDescription>
        </DialogHeader>

        {/* EKRAN SUKCESU */}
        {createdResidentId ? (
          <div className="space-y-6 py-6 text-center">
            <div className="w-12 h-12 bg-muted text-foreground rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                Przyjęcie zakończone pomyślnie!
              </h3>
              <p className="text-sm text-foreground max-w-md mx-auto">
                Podopieczny <strong>{firstName} {lastName}</strong> został pomyślnie przyjęty do placówki.
                {selectedBedInfo ? ` Przypisano: ${selectedBedInfo}.` : ''}
              </p>
            </div>
            <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 text-left text-xs text-foreground max-w-md mx-auto">
              <span className="font-semibold text-foreground block mb-1">Kolejny krok: Uzupełnienie dokumentacji</span>
              Możesz teraz przejść bezpośrednio do profilu podopiecznego, aby załączyć skan umowy oraz uzupełnić dane kontaktowe bliskich.
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
              >
                Zamknij
              </Button>
              <Link
                href={`/admin/residents/${createdResidentId}`}
                className={buttonVariants({ className: 'bg-primary hover:bg-primary/90 text-white gap-2' })}
              >
                <FileText className="w-4 h-4" />
                Przejdź do profilu podopiecznego i dodaj umowę
              </Link>
            </div>
          </div>
        ) : (
          <>
            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-muted text-foreground border border-border'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}
              >
                {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* KROK 1: DANE OSOBOWE */}
            {step === 1 && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="wiz-first-name">Imię</Label>
                    <Input
                      id="wiz-first-name"
                      placeholder="np. Anna"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wiz-last-name">Nazwisko</Label>
                    <Input
                      id="wiz-last-name"
                      placeholder="np. Kowalska"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wiz-id-val">PESEL</Label>
                  <Input
                    id="wiz-id-val"
                    placeholder="11 cyfr"
                    maxLength={11}
                    value={idValue}
                    onChange={(e) => handleIdChange(e.target.value)}
                  />
                  {idError && <p data-testid="national-id-error" className="text-xs text-destructive">{idError}</p>}
                  {calculatedBirthDate && calculatedGender && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-foreground bg-muted p-2 rounded border border-border">
                      <span>Data ur.: <strong>{calculatedBirthDate}</strong></span>
                      <span>Płeć: <strong>{calculatedGender === 'F' ? 'Kobieta' : 'Mężczyzna'}</strong></span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="wiz-care-level">Poziom sprawności</Label>
                    <NativeSelect
                      id="wiz-care-level" className="w-full"
                      value={careLevel}
                      onChange={(e) => setCareLevel(e.target.value as CareLevelType)}
                    >
                      <NativeSelectOption value="walking">Chodzący (parter lub wyższe piętra)</NativeSelectOption>
                      <NativeSelectOption value="sitting">Siedzący / wózek (rekomendowany parter)</NativeSelectOption>
                      <NativeSelectOption value="bedridden">Leżący (rekomendowany parter)</NativeSelectOption>
                      <NativeSelectOption value="hospice">Opieka paliatywna</NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="wiz-zsn"
                      checked={isZsn}
                      onChange={(e) => setIsZsn(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <Label htmlFor="wiz-zsn" className="text-sm font-normal cursor-pointer">
                      ZSN: Znaczny stopień niepełnosprawności
                    </Label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wiz-notes">Uwagi przyjęciowe</Label>
                  <Textarea
                    id="wiz-notes"
                    rows={2} className="w-full"
                    placeholder="Dodatkowe informacje dla personelu..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* KROK 2: SUGESTIA I WYBÓR ŁÓŻKA */}
            {step === 2 && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Rekomendowane łóżka</h4>
                    <p className="text-xs text-muted-foreground">Dopasowane według kryteriów płci w pokoju oraz piętra.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchSuggestions}
                    disabled={loadingSuggestions}
                    className="gap-1 text-xs"
                  >
                    {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-foreground" />}
                    Przelicz ponownie
                  </Button>
                </div>

                {loadingSuggestions ? (
                  <div className="py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analizowanie wolnych miejsc...
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="p-4 bg-muted text-foreground text-sm rounded-lg border border-border">
                    Brak dostępnych wolnych łóżek spełniających kryteria. Możesz przyjąć podopiecznego bez przypisania łóżka.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {suggestions.map((s) => {
                      const isSelected = selectedBedId === s.bedId
                      return (
                        <div
                          key={s.bedId}
                          onClick={() => {
                            setSelectedBedId(s.bedId)
                            setSelectedBedInfo(`Pokój ${s.roomNumber} (piętro ${s.floorNumber}), Łóżko ${s.bedNumber}`)
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:border-border bg-card'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Bed className="w-4 h-4 text-foreground" />
                              <span className="font-semibold text-sm text-foreground">
                                Pokój {s.roomNumber} — Łóżko {s.bedNumber}
                              </span>
                              <Badge variant="outline" className="text-xs font-normal">
                                Piętro {s.floorNumber}
                              </Badge>
                              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                Dopasowanie: {s.score} pkt
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {s.reason}
                            </p>
                          </div>
                          <div className="pt-1">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-primary bg-primary text-white' : 'border-border'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>{selectedBedInfo ? `Wybrano: ${selectedBedInfo}` : 'Nie wybrano żadnego łóżka'}</span>
                  {selectedBedId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBedId(null)
                        setSelectedBedInfo(null)
                      }}
                      className="text-destructive hover:underline"
                    >
                      Odznacz wybór
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* KROK 3: PODSUMOWANIE */}
            {step === 3 && (
              <div className="space-y-4 py-2 text-sm text-foreground">
                <div className="bg-muted p-4 rounded-lg border border-border space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">Imię i nazwisko</span>
                      <span className="font-semibold">{firstName} {lastName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Identyfikator (PESEL)</span>
                      <span className="font-mono">{idValue.slice(0, 6)}*****</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">Płeć i data ur.</span>
                      <span>{calculatedGender === 'F' ? 'Kobieta' : 'Mężczyzna'}, {calculatedBirthDate}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Profil opiekuńczy</span>
                      <span>{careLevel} {isZsn ? '(ZSN: Znaczny stopień niepełnosprawności)' : ''}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block">Przypisane łóżko</span>
                    <span className="font-medium text-foreground">
                      {selectedBedInfo || 'Brak przypisanego łóżka (można przypisać później)'}
                    </span>
                  </div>

                  {notes && (
                    <div>
                      <span className="text-xs text-muted-foreground block">Uwagi</span>
                      <span className="italic">{notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={submitting}
                >
                  Wstecz
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {step === 1 && (
                  <Button
                    type="button"
                    onClick={handleNextToStep2}
                    disabled={!firstName.trim() || !lastName.trim() || !calculatedGender || !!idError || idValue.trim().length !== 11}
                    className="bg-primary text-white"
                  >
                    Dalej (Wybór łóżka)
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    type="button"
                    onClick={handleNextToStep3}
                    className="bg-primary text-white"
                  >
                    Dalej (Podsumowanie)
                  </Button>
                )}

                {step === 3 && (
                  <Button
                    type="button"
                    onClick={handleSubmitAdmission}
                    disabled={submitting}
                    className="bg-primary text-white gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {submitting ? 'Przyjmowanie...' : 'Zatwierdź przyjęcie'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
