'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ResidentZsnCheckboxProps {
  residentId: string
  initialValue: boolean
  variant?: 'compact' | 'full'
  onChange?: (val: boolean) => void
}

export function ResidentZsnCheckbox({
  residentId,
  initialValue,
  variant = 'compact',
  onChange,
}: ResidentZsnCheckboxProps) {
  const [checked, setChecked] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (loading) return

    const nextValue = !checked
    setChecked(nextValue)
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/residents/${residentId}/zsn`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_zsn: nextValue }),
      })

      if (!res.ok) {
        // Revert on error
        setChecked(!nextValue)
        console.error('Failed to update ZSN')
      } else {
        onChange?.(nextValue)
        setSavedMessage(true)
        setTimeout(() => setSavedMessage(false), 2000)
      }
    } catch (err) {
      setChecked(!nextValue)
      console.error('Network error updating ZSN:', err)
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? 'ZSN: Znaczny stopień niepełnosprawności (Aktywny)' : 'Brak ZSN — kliknij, aby zaznaczyć'}
        title={checked ? 'ZSN: Znaczny stopień niepełnosprawności (Aktywny)' : 'Brak ZSN — kliknij, aby zaznaczyć'}
        className="group/zsn inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-slate/5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-colors"
      >
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            checked
              ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
              : 'border-slate/30 bg-white hover:border-slate/50'
          }`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-current" />
          ) : checked ? (
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          ) : null}
        </div>
        {checked && (
          <span className="text-[0.7rem] font-semibold tracking-wider text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            ZSN
          </span>
        )}
      </button>
    )
  }

  // Full variant for 360° card
  return (
    <button
      type="button"
      onClick={handleToggle}
      role="checkbox"
      aria-checked={checked}
      aria-label="ZSN: Znaczny stopień niepełnosprawności"
      className={`relative w-full text-left flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
        checked
          ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50'
          : 'bg-white border-slate/10 hover:border-slate/20 hover:bg-slate/5'
      }`}
    >
      <div className="pt-0.5">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            checked
              ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
              : 'border-slate/30 bg-white group-hover:border-slate/50'
          }`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-current" />
          ) : checked ? (
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          ) : null}
        </div>
      </div>

      <div className="flex-1 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate">
            ZSN: Znaczny stopień niepełnosprawności
          </span>
          {checked ? (
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[0.7rem]">
              Zaznaczono
            </Badge>
          ) : (
            <span className="text-xs text-slate-soft">Nieoznaczone</span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-soft">
          Orzeczenie o znacznym stopniu niepełnosprawności. Pensjonariusz jest automatycznie uwzględniany w dobowych raportach dziennych oraz analizach BI placówki.
        </p>
        {savedMessage && (
          <span className="mt-1.5 inline-block text-[0.7rem] font-medium text-emerald-600">
            ✓ Zapisano zmianę
          </span>
        )}
      </div>
    </button>
  )
}
