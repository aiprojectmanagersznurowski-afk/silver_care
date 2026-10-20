'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { isGroundFloor } from '@/lib/bed-allocation-optimizer'
import {
  ReassignBedFormFields,
  type AvailableBedOption,
} from './ReassignBedFormFields'

interface ReassignBedDialogProps {
  currentBedId: string
  currentBedLabel: string
  currentRoomNumber: string
  currentFloor?: string
  residentId: string
  residentName: string
  residentGender?: 'M' | 'F'
  residentIsZsn?: boolean
  residentCareLevel?: string
  onReassigned: () => void
}

export default function ReassignBedDialog({
  currentBedId,
  currentBedLabel,
  currentRoomNumber,
  currentFloor,
  residentId,
  residentName,
  residentGender,
  residentIsZsn,
  residentCareLevel,
  onReassigned,
}: ReassignBedDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedBedId, setSelectedBedId] = useState('')
  const [reason, setReason] = useState('Dostosowanie do stanu zdrowia')
  const [customReason, setCustomReason] = useState('')
  const [availableBeds, setAvailableBeds] = useState<AvailableBedOption[]>([])
  const [isLoadingBeds, setIsLoadingBeds] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      const fetchAvailableBeds = async () => {
        setIsLoadingBeds(true)
        try {
          const res = await fetch('/api/facility/rooms')
          if (!res.ok) throw new Error('Błąd pobierania pokoi')
          const data = await res.json()
          const rooms = data.rooms || []

          const options: AvailableBedOption[] = []
          for (const room of rooms) {
            const bedRes = await fetch(`/api/facility/beds?roomId=${room.id}`)
            if (bedRes.ok) {
              const bedData = await bedRes.json()
              const roomBeds = bedData.beds || []
              interface RoomBedItem {
                id: string
                label: string
                is_active: boolean
                active_assignment?: {
                  resident?: {
                    gender?: 'M' | 'F'
                  } | null
                } | null
              }

              const roomGenders: Array<'M' | 'F'> = (roomBeds as RoomBedItem[])
                .map((b) => b.active_assignment?.resident?.gender)
                .filter((g): g is 'M' | 'F' => g === 'M' || g === 'F')

              for (const bed of roomBeds as RoomBedItem[]) {
                if (bed.is_active && !bed.active_assignment && bed.id !== currentBedId) {
                  options.push({
                    bedId: bed.id,
                    bedLabel: bed.label,
                    roomId: room.id,
                    roomNumber: room.number,
                    floor: room.floor,
                    sector: room.sector,
                    existingGenders: roomGenders,
                  })
                }
              }
            }
          }
          setAvailableBeds(options)
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Nie udało się pobrać listy wolnych łóżek')
        } finally {
          setIsLoadingBeds(false)
        }
      }
      fetchAvailableBeds()
    }
  }, [open, currentBedId])

  const selectedOption = availableBeds.find((b) => b.bedId === selectedBedId)

  let genderWarning: string | null = null
  let mobilityWarning: string | null = null

  if (selectedOption && residentGender) {
    const conflictingGender = residentGender === 'M' ? 'F' : 'M'
    if (selectedOption.existingGenders.includes(conflictingGender)) {
      genderWarning = `W wybranym pokoju przebywa już pensjonariusz odmiennej płci (${selectedOption.existingGenders.join(', ')}). Wskazana zgodność płciowa.`
    }
  }

  if (selectedOption && (residentIsZsn || residentCareLevel === 'bedridden' || residentCareLevel === 'hospice')) {
    if (!isGroundFloor(selectedOption.floor)) {
      mobilityWarning = `Wybrane łóżko znajduje się na piętrze (${selectedOption.floor}). Dla pensjonariuszy z ZSN lub ograniczoną mobilnością rekomendowany jest parter.`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBedId) {
      toast.error('Wybierz docelowe łóżko z listy')
      return
    }

    setIsSubmitting(true)
    const finalReason = reason === 'Inny powód' ? (customReason || 'Przeniesienie') : reason

    try {
      const res = await fetch('/api/facility/beds/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bed_id: selectedBedId,
          resident_id: residentId,
          reason: finalReason,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się przenieść pensjonariusza')
      }

      toast.success(`Pomyślnie przeniesiono podopiecznego do pokoju ${selectedOption?.roomNumber}, łóżko ${selectedOption?.bedLabel}`)
      setOpen(false)
      onReassigned()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Wystąpił błąd podczas przenoszenia')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-sm h-8 text-foreground hover:bg-muted/50 border-border"
          />
        }
      >
        <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-primary" />
        Zmień łóżko
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przenieś pensjonariusza</DialogTitle>
            <DialogDescription>
              Wskaż nowe wolne miejsce dla podopiecznego. Poprzednie przypisanie zostanie
              automatycznie zamknięte z zachowaniem historii i audytu.
            </DialogDescription>
          </DialogHeader>

          <ReassignBedFormFields
            residentName={residentName}
            currentRoomNumber={currentRoomNumber}
            currentBedLabel={currentBedLabel}
            currentFloor={currentFloor}
            residentGender={residentGender}
            residentIsZsn={residentIsZsn}
            selectedBedId={selectedBedId}
            setSelectedBedId={setSelectedBedId}
            isLoadingBeds={isLoadingBeds}
            availableBeds={availableBeds}
            genderWarning={genderWarning}
            mobilityWarning={mobilityWarning}
            selectedOption={selectedOption}
            reason={reason}
            setReason={setReason}
            customReason={customReason}
            setCustomReason={setCustomReason}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedBedId}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? 'Przenoszenie...' : 'Potwierdź przeniesienie'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
