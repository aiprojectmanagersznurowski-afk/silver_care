'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus, Check, AlertCircle, Loader2 } from 'lucide-react'
import type { WizardStep } from './admission/admission-types'
import { useAdmissionWizard } from './admission/use-admission-wizard'
import { AdmissionStepPersonal } from './admission/AdmissionStepPersonal'
import { AdmissionStepBed } from './admission/AdmissionStepBed'
import { AdmissionStepSummary } from './admission/AdmissionStepSummary'
import { AdmissionSuccessView } from './admission/AdmissionSuccessView'

export function AdmissionWizard() {
  const {
    open, setOpen,
    step, setStep,
    firstName, setFirstName,
    lastName, setLastName,
    idValue, handleIdChange,
    careLevel, setCareLevel,
    isZsn, setIsZsn,
    notes, setNotes,
    calculatedGender, calculatedBirthDate, idError,
    suggestions, selectedBedId, setSelectedBedId,
    selectedBedInfo, setSelectedBedInfo, loadingSuggestions,
    handleFetchSuggestions, handleNextToStep2,
    submitting, createdResidentId, statusMessage, setStatusMessage,
    capacityWarning, capacityConfirmed, setCapacityConfirmed,
    resetForm, handleSubmitAdmission,
  } = useAdmissionWizard()

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger render={<Button className="min-h-touch px-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2" />}>
        <UserPlus className="w-4 h-4" />
        Nowe Przyjęcie (Kreator)
      </DialogTrigger>
      <DialogContent className="max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {createdResidentId ? (
              <>
                <Check className="w-5 h-5 text-primary" />
                Przyjęcie podopiecznego zakończone
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 text-primary" />
                Przyjęcie podopiecznego — Krok {step} z 3
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {createdResidentId
              ? 'Podsumowanie procedury przyjęcia podopiecznego do placówki.'
              : step === 1
              ? 'Krok 1: Wprowadź dane osobowe i profil opiekuńczy podopiecznego.'
              : step === 2
              ? 'Krok 2: Dobór pokoju i łóżka z uwzględnieniem płci i poziomu sprawności.'
              : 'Krok 3: Podsumowanie danych i zatwierdzenie przyjęcia.'}
          </DialogDescription>
        </DialogHeader>

        {createdResidentId ? (
          <AdmissionSuccessView
            firstName={firstName}
            lastName={lastName}
            selectedBedInfo={selectedBedInfo}
            createdResidentId={createdResidentId}
            onClose={() => { setOpen(false); resetForm(); }}
          />
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

            {step === 1 && (
              <AdmissionStepPersonal
                firstName={firstName} setFirstName={setFirstName}
                lastName={lastName} setLastName={setLastName}
                idValue={idValue} handleIdChange={handleIdChange}
                idError={idError} calculatedBirthDate={calculatedBirthDate}
                calculatedGender={calculatedGender}
                careLevel={careLevel} setCareLevel={setCareLevel}
                isZsn={isZsn} setIsZsn={setIsZsn}
                notes={notes} setNotes={setNotes}
              />
            )}

            {step === 2 && (
              <AdmissionStepBed
                suggestions={suggestions}
                selectedBedId={selectedBedId} setSelectedBedId={setSelectedBedId}
                selectedBedInfo={selectedBedInfo} setSelectedBedInfo={setSelectedBedInfo}
                loadingSuggestions={loadingSuggestions}
                onFetchSuggestions={handleFetchSuggestions}
              />
            )}

            {step === 3 && (
              <AdmissionStepSummary
                firstName={firstName} lastName={lastName}
                idValue={idValue} calculatedGender={calculatedGender}
                calculatedBirthDate={calculatedBirthDate}
                careLevel={careLevel} isZsn={isZsn}
                selectedBedInfo={selectedBedInfo} notes={notes}
              />
            )}

            {step === 3 && capacityWarning && (
              <div data-testid="capacity-limit-warning" role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground space-y-2">
                <p className="font-semibold">Przekroczenie limitu miejsc</p>
                <p className="text-muted-foreground">{capacityWarning}</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={capacityConfirmed} onChange={(e) => setCapacityConfirmed(e.target.checked)} className="rounded border-border text-primary focus:ring-primary" />
                  <span>Rozumiem, że przyjęcie przekroczy limit miejsc ustalony przez Administratora platformy</span>
                </label>
              </div>
            )}

            <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => (s === 3 ? 2 : 1) as WizardStep)}
                  disabled={submitting}
                  className="min-h-touch px-4"
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
                    className="min-h-touch px-4 bg-primary text-primary-foreground"
                  >
                    Dalej (Wybór łóżka)
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    type="button"
                    onClick={() => { setStatusMessage(null); setStep(3); }}
                    className="min-h-touch px-4 bg-primary text-primary-foreground"
                  >
                    Dalej (Podsumowanie)
                  </Button>
                )}

                {step === 3 && (
                  <Button
                    type="button"
                    onClick={handleSubmitAdmission}
                    disabled={submitting}
                    className="min-h-touch px-4 bg-primary text-primary-foreground gap-2"
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
