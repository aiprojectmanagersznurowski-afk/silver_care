'use client'

import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'

/**
 * Pasek nad listą jak w szablonie shadcn-admin (ADR-017): po lewej wyszukiwarka i filtry,
 * po prawej akcje widoku (np. ViewToggle). Na telefonie elementy układają się w kolumnie.
 */
export function ListToolbar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div data-slot="list-toolbar" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div data-slot="list-toolbar-main" className="flex flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {end && (
        <div data-slot="list-toolbar-end" className="flex flex-wrap items-center justify-end gap-2">
          {end}
        </div>
      )}
    </div>
  )
}

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Etykieta dla czytnika ekranu. */
  label: string
  placeholder?: string
  id?: string
}

/** Wyszukiwarka listy — jeden kształt na każdym ekranie, wysokość celu dotykowego z kontraktu. */
export function SearchField({ value, onChange, label, placeholder, id }: SearchFieldProps) {
  return (
    <InputGroup data-slot="search-field" className="h-touch w-full bg-background sm:w-64">
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Wyczyść wyszukiwanie" onClick={() => onChange('')} className="min-h-touch min-w-touch">
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

interface FilterChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  'data-testid'?: string
}

/** Przycisk filtra — wybrany w kolorze marki (jak ViewToggle), pozostałe w obrysie. */
export function FilterChip({ active, onClick, children, 'data-testid': testId }: FilterChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      data-slot="filter-chip"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-touch gap-1.5 px-3 ${
        active ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/90' : ''
      }`}
    >
      {children}
    </Button>
  )
}

/** Grupa filtrów z etykietą widoczną i czytaną przez czytnik ekranu. */
export function FilterGroup({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} data-filter-group={name} className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground" aria-hidden="true">{label}:</span>
      {children}
    </div>
  )
}
