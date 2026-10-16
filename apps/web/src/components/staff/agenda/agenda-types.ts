import { Sunrise, Sun, Sunset, Moon } from 'lucide-react'

export interface AgendaItem {
  id: string
  title: string
  time: string
  type: string
  resident_id: string | null
  target_date: string | null
}

export interface ResidentSummary {
  id: string
  first_name: string
  last_name: string
}

export type TimeSlotKey = 'morning' | 'noon' | 'afternoon' | 'evening'

export interface SlotDefinition {
  key: TimeSlotKey
  label: string
  timeRange: string
  icon: typeof Sunrise
  startHour: number
  endHour: number
}

export const TIME_SLOTS: SlotDefinition[] = [
  { key: 'morning', label: 'Rano', timeRange: '06:00 – 11:59', icon: Sunrise, startHour: 6, endHour: 11 },
  { key: 'noon', label: 'Południe', timeRange: '12:00 – 14:59', icon: Sun, startHour: 12, endHour: 14 },
  { key: 'afternoon', label: 'Popołudnie', timeRange: '15:00 – 17:59', icon: Sunset, startHour: 15, endHour: 17 },
  { key: 'evening', label: 'Wieczór i noc', timeRange: '18:00 – 05:59', icon: Moon, startHour: 18, endHour: 23 },
]

export const ITEM_TYPES = [
  { value: 'meal', label: 'Posiłek' },
  { value: 'activity', label: 'Aktywność i integracja' },
  { value: 'therapy', label: 'Terapia zajęciowa' },
  { value: 'hygiene', label: 'Higiena i toaleta' },
  { value: 'rest', label: 'Odpoczynek' },
  { value: 'other', label: 'Inne' },
]

export function getItemSlot(timeStr: string): TimeSlotKey {
  const hour = parseInt(timeStr.split(':')[0], 10)
  if (isNaN(hour)) return 'morning'
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'noon'
  if (hour >= 15 && hour < 18) return 'afternoon'
  return 'evening'
}

export function isCurrentSlot(slot: SlotDefinition): boolean {
  const nowHour = new Date().getHours()
  if (slot.key === 'evening') {
    return nowHour >= 18 || nowHour < 6
  }
  return nowHour >= slot.startHour && nowHour <= slot.endHour
}
