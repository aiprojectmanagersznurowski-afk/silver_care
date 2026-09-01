'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bed, DoorOpen, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import BedList from './BedList'
import AddBedDialog from './AddBedDialog'

interface RoomListProps {
  rooms: any[]
  onUpdate: () => void
}

export default function RoomList({ rooms, onUpdate }: RoomListProps) {
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({})

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }))
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center p-12 bg-muted/20 rounded-lg border border-dashed">
        <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Brak pokoi</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Dodaj pierwszy pokój, aby móc zarządzać łóżkami.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 mt-8">
      {rooms.map(room => (
        <Card key={room.id} className="overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => toggleRoom(room.id)}
          >
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <DoorOpen className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold text-lg">Pokój {room.number}</span>
              </div>
              <div className="flex space-x-4 text-sm text-muted-foreground">
                <span>Piętro: {room.floor}</span>
                {room.sector && <span>Sektor: {room.sector}</span>}
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1" title="Liczba łóżek">
                  <Bed className="w-4 h-4" />
                  <span>{room.beds || 0}</span>
                </div>
                <div className="flex items-center space-x-1" title="Zajęte łóżka">
                  <Users className="w-4 h-4" />
                  <span>{room.occupied || 0}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {expandedRooms[room.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          {expandedRooms[room.id] && (
            <CardContent className="bg-muted/10 pt-4 border-t">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">Zarządzanie łóżkami</h4>
                <AddBedDialog roomId={room.id} onBedAdded={onUpdate} />
              </div>
              <BedList roomId={room.id} onUpdate={onUpdate} />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
