import { useState, useRef, useTransition, useCallback, useEffect } from 'react'
import type { SearchCategoryKey, SearchResultItem } from '@/lib/global-search-helpers'
import { searchGlobalAction } from '@/actions/global-search'
import { createRequestGuard } from '@/lib/search-request-guard'

export const LISTBOX_ID = 'global-search-listbox'
export const optionId = (idx: number) => `global-search-option-${idx}`

export function useCommandPalette(onSelectItem: (item: SearchResultItem) => void) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryKey | 'all'>('all')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [guard] = useState(createRequestGuard)

  // Po zamknięciu okna żadna spóźniona odpowiedź ani zaplanowane zapytanie nie może już zmienić stanu
  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      guard.invalidate()
    },
    [guard]
  )

  const executeSearch = useCallback(
    (q: string, cat: SearchCategoryKey | 'all') => {
      if (!q.trim() || q.trim().length < 2) {
        guard.invalidate()
        setResults([])
        setErrorMessage(null)
        return
      }

      const requestId = guard.next()
      startTransition(async () => {
        try {
          const res = await searchGlobalAction(q, cat)
          if (!guard.isCurrent(requestId)) return // starsza odpowiedź nie nadpisuje nowszej
          if (!res.success) {
            setErrorMessage(res.error || 'Błąd wyszukiwania.')
            setResults([])
          } else {
            setResults(res.items)
            setSelectedIndex(0)
            setErrorMessage(null)
          }
        } catch {
          if (!guard.isCurrent(requestId)) return
          setErrorMessage('Wystąpił problem z połączeniem.')
          setResults([])
        }
      })
    },
    [guard]
  )

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (val.trim().length < 2) {
      guard.invalidate() // wyczyszczenie pola od razu unieważnia zapytanie w toku
      setResults([])
      setErrorMessage(null)
    }
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val, categoryFilter)
    }, 200)
  }

  const handleCategoryFilterChange = (cat: SearchCategoryKey | 'all') => {
    setCategoryFilter(cat)
    executeSearch(query, cat)
  }

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
        onSelectItem(results[selectedIndex])
      }
    }
  }

  const retry = () => executeSearch(query, categoryFilter)

  const resetSearch = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    guard.invalidate()
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    setErrorMessage(null)
  }

  return {
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
    activeOptionId: results.length > 0 ? optionId(selectedIndex) : undefined,
  }
}
