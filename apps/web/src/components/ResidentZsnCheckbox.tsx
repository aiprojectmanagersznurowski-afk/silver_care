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
        className="group/zsn inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-border transition-colors"
      >
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            checked
              ? 'bg-primary border-border text-white'
              : 'border-border bg-card hover:border-border'
          }`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-current" />
          ) : checked ? (
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          ) : null}
        </div>
        {checked && (
          <span className="text-[0.7rem] font-semibold tracking-wider text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
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
      className={`relative w-full text-left flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border ${
        checked
          ? 'bg-muted border-border hover:bg-muted'
          : 'bg-card border-border hover:border-border hover:bg-muted/50'
      }`}
    >
      <div className="pt-0.5">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            checked
              ? 'bg-primary border-border text-white'
              : 'border-border bg-card group-hover:border-border'
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
          <span className="font-semibold text-sm text-foreground">
            ZSN: Znaczny stopień niepełnosprawności
          </span>
          {checked ? (
            <Badge className="bg-muted text-foreground border-border text-[0.7rem]">
              Zaznaczono
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Nieoznaczone</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Orzeczenie o znacznym stopniu niepełnosprawności. Pensjonariusz jest automatycznie uwzględniany w dobowych raportach dziennych oraz analizach BI placówki.
        </p>
        {savedMessage && (
          <span className="mt-1.5 inline-block text-[0.7rem] font-medium text-foreground">
            ✓ Zapisano zmianę
          </span>
        )}
      </div>
    </button>
  )
}
