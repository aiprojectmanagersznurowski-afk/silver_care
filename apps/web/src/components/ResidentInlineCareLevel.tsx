'use client'

import React, { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { CARE_LEVEL_LABELS, CARE_LEVEL_COLORS, type CareLevel } from '@/lib/reporting-constants'
import { updateResidentInlineAction } from '@/actions/resident-inline'
import { Check, ChevronDown, Loader2, AlertCircle } from 'lucide-react'

interface ResidentInlineCareLevelProps {
  residentId: string
  initialCareLevel: CareLevel | null
}

const CARE_OPTIONS: Array<{ value: CareLevel; label: string }> = [
  { value: 'walking', label: 'Chodzący' },
  { value: 'sitting', label: 'Siedzący' },
  { value: 'bedridden', label: 'Leżący' },
  { value: 'hospice', label: 'Opieka paliatywna' },
]

export function ResidentInlineCareLevel({
  residentId,
  initialCareLevel,
}: ResidentInlineCareLevelProps) {
  const [currentLevel, setCurrentLevel] = useState<CareLevel | null>(initialCareLevel)
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSelect = (nextLevel: CareLevel) => {
    if (nextLevel === currentLevel) {
      setIsOpen(false)
      return
    }

    const previousLevel = currentLevel
    // Optymistyczna aktualizacja UI
    setCurrentLevel(nextLevel)
    setIsOpen(false)
    setErrorMessage(null)

    startTransition(async () => {
      try {
        const result = await updateResidentInlineAction({
          residentId,
          care_level: nextLevel,
        })

        if (!result.success) {
          // Rollback przy błędzie
          setCurrentLevel(previousLevel)
          setErrorMessage(result.error || 'Nie udało się zaktualizować stanu podopiecznego.')
          setTimeout(() => setErrorMessage(null), 4000)
        }
      } catch (err: unknown) {
        // Rollback przy błędzie sieci
        setCurrentLevel(previousLevel)
        setErrorMessage(err instanceof Error ? err.message : 'Błąd połączenia z serwerem.')
        setTimeout(() => setErrorMessage(null), 4000)
      }
    })
  }

  const effectiveLevel = currentLevel || 'unknown'

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="group inline-flex items-center gap-1.5 min-h-[48px] px-2 py-1 rounded-lg hover:bg-slate/5 focus:outline-none focus:ring-2 focus:ring-sage/50 transition-colors"
        aria-label="Zmień stan podopiecznego"
        aria-expanded={isOpen}
      >
        {currentLevel ? (
          <Badge
            variant="outline"
            style={{
              backgroundColor: `${CARE_LEVEL_COLORS[effectiveLevel]}15`,
              color: CARE_LEVEL_COLORS[effectiveLevel],
              borderColor: `${CARE_LEVEL_COLORS[effectiveLevel]}40`,
            }}
            className="text-xs py-1 px-2 cursor-pointer flex items-center gap-1"
          >
            {CARE_LEVEL_LABELS[effectiveLevel]}
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin text-current ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
            )}
          </Badge>
        ) : (
          <span className="text-slate-soft/70 text-xs hover:text-slate flex items-center gap-1 border border-dashed border-slate/20 px-2 py-1 rounded">
            + Ustaw stan
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin text-current ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
            )}
          </span>
        )}
      </button>

      {errorMessage && (
        <div
          role="alert"
          className="absolute z-30 top-full left-0 mt-1 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 mt-1 w-48 rounded-xl bg-white shadow-lg ring-1 ring-black/5 z-30 py-1 divide-y divide-slate/5">
            <div className="px-3 py-1.5 text-[0.7rem] font-semibold text-slate-soft uppercase tracking-wider">
              Zmień poziom opieki
            </div>
            <div className="py-1">
              {CARE_OPTIONS.map((option) => {
                const isSelected = currentLevel === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate hover:bg-slate/5 text-left transition-colors min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CARE_LEVEL_COLORS[option.value] }}
                      />
                      {option.label}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-sage stroke-[2.5]" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
