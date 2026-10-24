'use client'

import { LayoutGrid, Table as TableIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export interface ViewToggleOption<T extends string> {
  value: T
  label: string
  /** Etykieta dla czytnika ekranu, np. „Widok tabeli”. */
  ariaLabel: string
  icon: ReactNode
}

interface ViewToggleProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly ViewToggleOption<T>[]
}

/** Standardowe opcje listy obiektów: tabela (domyślna) i kafelki. */
export const GRID_TABLE_OPTIONS = [
  { value: 'table', label: 'Tabela', ariaLabel: 'Widok tabeli', icon: <TableIcon /> },
  { value: 'grid', label: 'Kafelki', ariaLabel: 'Widok kafelków', icon: <LayoutGrid /> },
] as const satisfies readonly ViewToggleOption<'table' | 'grid'>[]

/**
 * Wspólny przełącznik widoku listy (ADR-017): jeden kształt na każdym ekranie,
 * wybrany przycisk w kolorze marki, pozostałe neutralne.
 */
export function ViewToggle<T extends string>({ value, onChange, options }: ViewToggleProps<T>) {
  return (
    <div
      data-slot="view-toggle"
      role="group"
      aria-label="Tryb widoku"
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/50 p-1"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={`min-h-touch gap-1.5 px-3 ${
              active ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-foreground'
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
