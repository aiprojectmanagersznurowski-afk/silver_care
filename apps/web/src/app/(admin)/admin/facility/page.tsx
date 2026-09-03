'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Bed, DoorClosed, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import AddRoomDialog from '@/components/facility/AddRoomDialog'
import RoomList from '@/components/facility/RoomList'

export default function FacilityManagementPage() {
  const [rooms, setRooms] = useState<any[]>([])
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
    fetchRooms()
  }, [])

  const totalBeds = rooms.reduce((acc, room) => acc + (room.beds || 0), 0)
  const occupiedBeds = rooms.reduce((acc, room) => acc + (room.occupied || 0), 0)
  const freeBeds = rooms.reduce((acc, room) => acc + (room.free || 0), 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Struktura Placówki
          </h2>
          <p className="mt-2 text-slate-soft">
            Zarządzaj pokojami i łóżkami w twojej placówce.
          </p>
        </div>
        <AddRoomDialog onRoomAdded={fetchRooms} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage/10 text-sage">
                <DoorClosed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Liczba pokoi</p>
                <h3 className="text-2xl font-bold text-slate">{rooms.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate/10 text-slate">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Wszystkie łóżka</p>
                <h3 className="text-2xl font-bold text-slate">{totalBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Zajęte łóżka</p>
                <h3 className="text-2xl font-bold text-slate">{occupiedBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Wolne łóżka</p>
                <h3 className="text-2xl font-bold text-slate">{freeBeds}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage"></div>
        </div>
      ) : (
        <RoomList rooms={rooms} onUpdate={fetchRooms} />
      )}
    </div>
  )
}
