'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Bed, DoorClosed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Ośrodkiem</h1>
          <p className="text-muted-foreground mt-2">
            Zarządzaj pokojami i łóżkami w twojej placówce.
          </p>
        </div>
        <AddRoomDialog onRoomAdded={fetchRooms} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba pokoi</CardTitle>
            <DoorClosed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rooms.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie łóżka</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBeds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zajęte łóżka</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupiedBeds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wolne łóżka</CardTitle>
            <Bed className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{freeBeds}</div>
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
