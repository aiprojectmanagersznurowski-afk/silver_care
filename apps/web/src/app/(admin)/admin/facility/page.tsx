'use client'

import { useState, useEffect } from 'react'
import { Users, Bed, DoorClosed } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import AddRoomDialog from '@/components/facility/AddRoomDialog'
import { FacilityImportExportDialog } from '@/components/facility/FacilityImportExportDialog'
import { BedAllocationOptimizerDialog } from '@/components/facility/BedAllocationOptimizerDialog'
import RoomList, { RoomItem } from '@/components/facility/RoomList'
import { PageHeader } from '@/components/patterns/PageHeader'

export default function FacilityManagementPage() {
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchRooms = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/facility/rooms')
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms || [])
      }
    } catch (error) {
      console.error('Failed to fetch rooms', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => fetchRooms())
  }, [])

  const totalBeds = rooms.reduce((acc, room) => acc + (room.beds || 0), 0)
  const occupiedBeds = rooms.reduce((acc, room) => acc + (room.occupied || 0), 0)
  const freeBeds = rooms.reduce((acc, room) => acc + (room.free || 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Struktura Placówki"
        description="Zarządzaj pokojami i łóżkami w twojej placówce."
        actions={
          <>
            <FacilityImportExportDialog onStructureChanged={fetchRooms} />
            <BedAllocationOptimizerDialog onAllocationChanged={fetchRooms} />
            <AddRoomDialog onRoomAdded={fetchRooms} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <DoorClosed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Liczba pokoi</p>
                <h3 className="text-2xl font-bold text-foreground">{rooms.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wszystkie łóżka</p>
                <h3 className="text-2xl font-bold text-foreground">{totalBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Zajęte łóżka</p>
                <h3 className="text-2xl font-bold text-foreground">{occupiedBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wolne łóżka</p>
                <h3 className="text-2xl font-bold text-foreground">{freeBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <RoomList rooms={rooms} onUpdate={fetchRooms} />
      )}
    </div>
  )
}
