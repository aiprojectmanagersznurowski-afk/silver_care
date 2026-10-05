'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft, AlertTriangle, CheckCircle2, BedDouble } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { isGroundFloor } from '@/lib/bed-allocation-optimizer'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface AvailableBedOption {
  bedId: string
  bedLabel: string
  roomId: string
  roomNumber: string
  floor: string
  sector?: string | null
  existingGenders: Array<'M' | 'F'>
}

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

              const roomGenders: Array<'M' | 'F'> = roomBeds
                .filter((b: any) => b.active_assignment?.resident?.gender)
                .map((b: any) => b.active_assignment.resident.gender)

              for (const bed of roomBeds) {
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
        } catch (err: any) {
          toast.error(err.message || 'Nie udało się pobrać listy wolnych łóżek')
        } finally {
          setIsLoadingBeds(false)
        }
      }
      fetchAvailableBeds()
    }
  }, [open, currentBedId])

  const selectedOption = availableBeds.find((b) => b.bedId === selectedBedId)

  // Sprawdzenie reguł alokacji
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
    } catch (err: any) {
      toast.error(err.message || 'Wystąpił błąd podczas przenoszenia')
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
            className="text-xs h-8 text-foreground hover:bg-muted/50 border-border"
          />
        }
      >
        <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-primary" />
        Zmień łóżko
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przenieś pensjonariusza</DialogTitle>
            <DialogDescription>
              Wskaż nowe wolne miejsce dla podopiecznego. Poprzednie przypisanie zostanie
              automatycznie zamknięte z zachowaniem historii i audytu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Aktualne przypisanie */}
            <div className="rounded-lg bg-muted/40 p-3 text-sm border space-y-1">
              <div className="font-medium text-foreground">{residentName}</div>
              <div className="text-muted-foreground text-xs">
                Obecne miejsce: <strong>Pokój {currentRoomNumber}</strong>, Łóżko {currentBedLabel}
                {currentFloor ? ` (${currentFloor})` : ''}
              </div>
              {residentGender && (
                <div className="text-xs text-muted-foreground">
                  Płeć: <strong>{residentGender === 'M' ? 'Mężczyzna' : 'Kobieta'}</strong>
                  {residentIsZsn ? ' • ZSN (Zwiększone zapotrzebowanie na opiekę)' : ''}
                </div>
              )}
            </div>

            {/* Wybór docelowego łóżka */}
            <div className="space-y-2">
              <Label htmlFor="target-bed">Docelowe wolne łóżko</Label>
              {isLoadingBeds ? (
                <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
                  Wyszukiwanie wolnych łóżek w placówce...
                </div>
              ) : availableBeds.length === 0 ? (
                <div className="text-xs text-foreground bg-muted p-2.5 rounded border border-border">
                  Brak wolnych łóżek w innych pokojach placówki.
                </div>
              ) : (
                <NativeSelect
                  id="target-bed"
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)} className="flex w-full"
                  required
                >
                  <NativeSelectOption value="" disabled>Wybierz wolne łóżko</NativeSelectOption>
                  {availableBeds.map((bed) => (
                    <NativeSelectOption key={bed.bedId} value={bed.bedId}>
                      Pokój {bed.roomNumber} ({bed.floor}{bed.sector ? `, Sektor ${bed.sector}` : ''}) — Łóżko {bed.bedLabel}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>

            {/* Transparentne reguły i ostrzeżenia */}
            {genderWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border text-foreground text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-foreground mt-0.5" />
                <div>{genderWarning}</div>
              </div>
            )}

            {mobilityWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border text-foreground text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-foreground mt-0.5" />
                <div>{mobilityWarning}</div>
              </div>
            )}

            {selectedOption && !genderWarning && !mobilityWarning && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border text-foreground text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-foreground" />
                <span>Wybrane miejsce spełnia wszystkie standardy transparentnej alokacji.</span>
              </div>
            )}

            {/* Powód przeniesienia */}
            <div className="space-y-2">
              <Label htmlFor="reassign-reason">Powód zmiany łóżka</Label>
              <NativeSelect
                id="reassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)} className="flex w-full"
              >
                <NativeSelectOption value="Dostosowanie do stanu zdrowia">Dostosowanie do stanu zdrowia / mobilności</NativeSelectOption>
                <NativeSelectOption value="Prośba pensjonariusza lub rodziny">Prośba pensjonariusza lub rodziny</NativeSelectOption>
                <NativeSelectOption value="Optymalizacja struktury pokoi">Optymalizacja struktury placówki / zgodność płci</NativeSelectOption>
                <NativeSelectOption value="Remont lub reorganizacja pokoju">Remont lub reorganizacja pokoju</NativeSelectOption>
                <NativeSelectOption value="Inny powód">Inny powód...</NativeSelectOption>
              </NativeSelect>
              {reason === 'Inny powód' && (
                <input
                  type="text"
                  placeholder="Wpisz powód przeniesienia..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                />
              )}
            </div>
          </div>

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
