import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlacePrediction {
  place_id: string
  description: string
  main_text?: string
  secondary_text?: string
}

export function AddressPredictionDropdown({
  isOpen,
  predictions,
  activeIndex,
  setActiveIndex,
  onSelect,
}: {
  isOpen: boolean
  predictions: PlacePrediction[]
  activeIndex: number
  setActiveIndex: (idx: number) => void
  onSelect: (prediction: PlacePrediction) => void
}) {
  if (!isOpen || predictions.length === 0) return null

  return (
    <ul
      role="listbox"
      className="absolute left-0 right-0 z-[100] mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-popover/95 backdrop-blur-sm p-1.5 shadow-xl text-sm text-popover-foreground transition-all duration-100 ease-out"
    >
      {predictions.map((p, idx) => {
        const isActive = idx === activeIndex
        return (
          <li
            key={p.place_id || idx}
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(p)
            }}
            onMouseEnter={() => setActiveIndex(idx)}
            className={cn(
              'flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
            )}
          >
            <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm sm:text-sm truncate">
                {p.main_text || p.description}
              </span>
              {p.secondary_text && (
                <span className="text-sm text-muted-foreground truncate">
                  {p.secondary_text}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
