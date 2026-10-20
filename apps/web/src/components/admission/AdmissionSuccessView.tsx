'use client'

import React from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Check, FileText } from 'lucide-react'

interface AdmissionSuccessViewProps {
  firstName: string
  lastName: string
  selectedBedInfo: string | null
  createdResidentId: string
  onClose: () => void
}

export function AdmissionSuccessView({
  firstName,
  lastName,
  selectedBedInfo,
  createdResidentId,
  onClose,
}: AdmissionSuccessViewProps) {
  return (
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
      <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 text-left text-sm text-foreground max-w-md mx-auto">
        <span className="font-semibold text-foreground block mb-1">Kolejny krok: Uzupełnienie dokumentacji</span>
        Możesz teraz przejść bezpośrednio do profilu podopiecznego, aby załączyć skan umowy oraz uzupełnić dane kontaktowe bliskich.
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onClose}
        >
          Zamknij
        </Button>
        <Link
          href={`/admin/residents/${createdResidentId}`}
          className={buttonVariants({ className: 'bg-primary hover:bg-primary/90 text-primary-foreground gap-2' })}
        >
          <FileText className="w-4 h-4" />
          Przejdź do profilu podopiecznego i dodaj umowę
        </Link>
      </div>
    </div>
  )
}
