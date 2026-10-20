import { useState, useRef, useTransition, useCallback } from 'react'
import type { SearchCategoryKey, SearchResultItem } from '@/lib/global-search-helpers'
import { searchGlobalAction } from '@/actions/global-search'

export function useCommandPalette(onSelectItem: (item: SearchResultItem) => void) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryKey | 'all'>('all')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  const resetSearch = () => {
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
  }
}
