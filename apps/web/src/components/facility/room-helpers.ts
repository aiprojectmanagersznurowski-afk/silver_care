export interface RoomItem {
  id: string
  number: string
  floor: string
  sector?: string | null
  beds: number
  occupied: number
  free: number
  is_active?: boolean
  genderDistribution?: {
    males: number
    females: number
  }
}

export function getRoomGenderLabel(room: RoomItem) {
  if (!room.occupied || room.occupied === 0) {
    return { label: 'Wolny pokój', variant: 'neutral' as const }
  }
  const dist = room.genderDistribution
  if (dist) {
    if (dist.males > 0 && dist.females > 0) {
      return { label: `Mieszany (${dist.males}M / ${dist.females}K)`, variant: 'warning' as const }
    }
    if (dist.males > 0) {
      return { label: `Mężczyźni (${dist.males})`, variant: 'male' as const }
    }
    if (dist.females > 0) {
      return { label: `Kobiety (${dist.females})`, variant: 'female' as const }
    }
  }
  return { label: `${room.occupied} zajęte`, variant: 'neutral' as const }
}
