'use client'

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Command,
  X,
  User,
  BedDouble,
  Calendar,
  FileText,
  Building2,
  Loader2,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react'
import {
  SearchCategoryKey,
  SearchResultItem,
  SEARCH_CATEGORIES,
} from '@/lib/global-search-helpers'
import { searchGlobalAction } from '@/actions/global-search'
import { Badge } from '@/components/ui/badge'

interface GlobalCommandPaletteProps {
  userRole?: string | null
}

const CATEGORY_ICONS: Record<SearchCategoryKey, React.ComponentType<{ className?: string }>> = {
  residents: User,
  facility: BedDouble,
  agenda: Calendar,
  reports: FileText,
  staff: User,
  organizations: Building2,
}

export function GlobalCommandPalette({ userRole }: GlobalCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryKey | 'all'>('all')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

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
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setErrorMessage(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // 3. Wyszukiwanie z debouncingiem (200ms)
  const executeSearch = useCallback(
    (q: string, cat: SearchCategoryKey | 'all') => {
      if (!q.trim() || q.trim().length < 2) {
        setResults([])
        setErrorMessage(null)
        return
      }

      startTransition(async () => {
        try {
          const res = await searchGlobalAction(q, cat)
          if (!res.success) {
            setErrorMessage(res.error || 'Błąd wyszukiwania.')
            setResults([])
          } else {
            setResults(res.items)
            setSelectedIndex(0)
            setErrorMessage(null)
          }
        } catch {
          setErrorMessage('Wystąpił problem z połączeniem.')
          setResults([])
        }
      })
    },
    []
  )

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, categoryFilter)
    }, 200)
  }

  const handleCategoryFilterChange = (cat: SearchCategoryKey | 'all') => {
    setCategoryFilter(cat)
    executeSearch(query, cat)
  }

  const handleSelectItem = (item: SearchResultItem) => {
    setIsOpen(false)
    router.push(item.href)
  }

  // 4. Obsługa klawiatury w liście (ArrowUp, ArrowDown, Enter)
  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelectItem(results[selectedIndex])
      }
    }
  }

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
      {/* Przycisk wyzwalacza w pasku nawigacyjnym / headerze */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card/80 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors min-h-[38px]"
        title="Otwórz wyszukiwarkę globalną (Cmd+K)"
        aria-label="Wyszukaj w systemie"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Szukaj w systemie...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      {/* Modal Spotlight / Command Palette */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          {/* Tło / Backdrop */}
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
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground inline-flex items-center justify-center min-h-[36px] min-w-[36px]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Szybkie filtry pigułkowe (Pills) */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto text-xs">
              <span className="text-[11px] text-muted-foreground shrink-0 mr-1">Filtruj:</span>
              {availableCategories.map((cat) => {
                const isActive = categoryFilter === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryFilterChange(cat.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
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
            <div className="max-h-84 overflow-y-auto p-2 divide-y divide-border/60">
              {/* Stan 1: Brak zapytania (podpowiedź startowa) */}
              {!query.trim() && (
                <div className="py-8 px-4 text-center space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    Szybkie przeszukiwanie placówki
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Wpisz co najmniej 2 znaki, aby odnaleźć podopiecznego, sprawdzić pokój i łóżko,
                    przejrzeć plan dnia lub otworzyć raport dobowy.
                  </p>
                </div>
              )}

              {/* Stan 2: Błąd */}
              {errorMessage && (
                <div className="p-4 text-center text-xs text-destructive">
                  {errorMessage}
                </div>
              )}

              {/* Stan 3: Brak wyników */}
              {query.trim().length >= 2 && !isPending && results.length === 0 && !errorMessage && (
                <div className="py-8 px-4 text-center text-sm text-muted-foreground">
                  Brak wyników pasujących do &quot;<strong className="text-foreground">{query}</strong>&quot;.
                </div>
              )}

              {/* Stan 4: Lista wyników */}
              {results.length > 0 &&
                results.map((item, idx) => {
                  const isSelected = idx === selectedIndex
                  const IconComponent = CATEGORY_ICONS[item.category] || FileText

                  return (
                    <div
                      key={`${item.category}-${item.id}`}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer min-h-[48px] ${
                        isSelected
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.badge && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-muted-foreground ml-3">
                        <span className="text-[10px] hidden sm:inline uppercase tracking-wider font-medium">
                          {SEARCH_CATEGORIES[item.category]?.label}
                        </span>
                        {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Stopka nawigacji klawiaturowej */}
            <div className="border-t border-border px-4 py-2.5 bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Nawigacja: ↑ ↓ strzałki | Wybierz: Enter</span>
              <span>Zamknij: Esc</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
