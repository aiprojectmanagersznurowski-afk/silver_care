'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Command, X, Loader2 } from 'lucide-react'
import { SearchCategoryKey, SearchResultItem } from '@/lib/global-search-helpers'
import { CommandPaletteResults } from '@/components/search/CommandPaletteResults'
import { useCommandPalette } from '@/components/search/useCommandPalette'

interface GlobalCommandPaletteProps {
  userRole?: string | null
}

export function GlobalCommandPalette({ userRole }: GlobalCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelectItem = (item: SearchResultItem) => {
    setIsOpen(false)
    router.push(item.href)
  }

  const {
    query,
    categoryFilter,
    results,
    selectedIndex,
    setSelectedIndex,
    isPending,
    errorMessage,
    handleQueryChange,
    handleCategoryFilterChange,
    handleKeyDownList,
    resetSearch,
  } = useCommandPalette(handleSelectItem)

  // 1. Skrót globalny Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // 2. Focus na input po otwarciu
  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(() => resetSearch())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const isSuperAdmin = userRole === 'super_admin'

  const availableCategories: Array<{ key: SearchCategoryKey | 'all'; label: string }> = [
    { key: 'all', label: 'Wszystko' },
    { key: 'residents', label: 'Podopieczni' },
    { key: 'facility', label: 'Pokoje i łóżka' },
    { key: 'agenda', label: 'Plan dnia' },
    { key: 'reports', label: 'Raporty' },
    ...(isSuperAdmin ? [{ key: 'organizations' as const, label: 'Placówki' }] : []),
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card/80 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors min-h-touch"
        title="Otwórz wyszukiwarkę globalną (Cmd+K)"
        aria-label="Wyszukaj w systemie"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Szukaj w systemie...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-muted-foreground">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Globalna wyszukiwarka systemowa"
            className="relative w-full max-w-xl md:max-w-2xl rounded-xl bg-card shadow-2xl ring-1 ring-border overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input wyszukiwania */}
            <div className="flex items-center border-b border-border px-4 py-1">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Szukaj podopiecznego, numeru pokoju, zadania lub raportu..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDownList}
                className="w-full px-3 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none bg-transparent"
              />
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2 shrink-0" />}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground inline-flex items-center justify-center min-h-touch min-w-touch"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Szybkie filtry pigułkowe (Pills) */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto text-sm">
              <span className="text-sm text-muted-foreground shrink-0 mr-1">Filtruj:</span>
              {availableCategories.map((cat) => {
                const isActive = categoryFilter === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryFilterChange(cat.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 min-h-touch inline-flex items-center justify-center ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Ciało wyszukiwarki: 4 stany */}
            <CommandPaletteResults
              query={query}
              isPending={isPending}
              errorMessage={errorMessage}
              results={results}
              selectedIndex={selectedIndex}
              onSelectItem={handleSelectItem}
              onHoverIndex={setSelectedIndex}
            />

            {/* Stopka nawigacji klawiaturowej */}
            <div className="border-t border-border px-4 py-2.5 bg-muted/40 flex items-center justify-between text-sm text-muted-foreground">
              <span>Nawigacja: ↑ ↓ strzałki | Wybierz: Enter</span>
              <span>Zamknij: Esc</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
