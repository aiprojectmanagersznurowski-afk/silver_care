'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Command, X, Loader2 } from 'lucide-react'
import { SearchCategoryKey, SearchResultItem } from '@/lib/global-search-helpers'
import { CommandPaletteResults } from '@/components/search/CommandPaletteResults'
import { useCommandPalette, LISTBOX_ID, optionId } from '@/components/search/useCommandPalette'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface GlobalCommandPaletteProps {
  userRole?: string | null
}

export function GlobalCommandPalette({ userRole }: GlobalCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelectItem = (item: SearchResultItem) => {
    if (!item.href) return // pozycja informacyjna (np. wolne łóżko dla pielęgniarki) — bez przejścia
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
    retry,
    activeOptionId,
  } = useCommandPalette(handleSelectItem)

  // 1. Skrót globalny Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 2. Czysty stan po otwarciu; fokus, Escape i powrót fokusu obsługuje Dialog
  useEffect(() => {
    if (isOpen) void Promise.resolve().then(() => resetSearch())
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
        className="inline-flex min-h-touch items-center gap-2 px-1 text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
        title="Otwórz wyszukiwarkę globalną (Cmd+K)"
        aria-label="Wyszukaj w systemie"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Szukaj</span>
        <kbd className="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-xs font-medium sm:inline-flex">
          <Command className="size-3" />K
        </kbd>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          aria-label="Globalna wyszukiwarka systemowa"
          initialFocus={inputRef}
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-24 sm:left-1/2 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-xl md:max-w-2xl"
        >
          {/* Input wyszukiwania */}
          <div className="flex items-center border-b border-border px-4 py-1">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Szukaj w systemie"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls={LISTBOX_ID}
              aria-activedescendant={activeOptionId}
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
              aria-label="Zamknij wyszukiwarkę"
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
            onRetry={retry}
            listboxId={LISTBOX_ID}
            getOptionId={optionId}
          />

          {/* Stopka nawigacji klawiaturowej */}
          <div className="border-t border-border px-4 py-2.5 bg-muted/40 flex items-center justify-between text-sm text-muted-foreground">
            <span>Nawigacja: ↑ ↓ strzałki | Wybierz: Enter</span>
            <span>Zamknij: Esc</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
