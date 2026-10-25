import type { SearchCategoryKey, SearchResultItem } from './global-search-helpers'

/** Ile kandydatów pobiera zapytanie i ile pozycji zostaje w grupie po rankingu. */
export const SEARCH_CANDIDATE_LIMIT = 12
export const SEARCH_GROUP_LIMIT = 6

/** Małe litery bez znaków diakrytycznych (także ł, którego rozkład NFD nie obejmuje) — do porównań w rankingu. */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '')
}

/** 0 = każde słowo frazy jest dokładnym słowem wyniku, 1 = każde jest początkiem słowa, 2 = reszta (sam fragment). */
export function matchScore(item: Pick<SearchResultItem, 'title' | 'subtitle'>, cleanQuery: string): 0 | 1 | 2 {
  const queryWords = normalizeForSearch(cleanQuery).split(' ').filter(Boolean)
  if (queryWords.length === 0) return 2
  const words = normalizeForSearch(`${item.title} ${item.subtitle}`).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (queryWords.every((q) => words.includes(q))) return 0
  if (queryWords.every((q) => words.some((w) => w.startsWith(q)))) return 1
  return 2
}

/**
 * Porządkuje wyniki w obrębie każdej grupy: lepsze dopasowanie wyżej, przy równym aktywni przed archiwalnymi
 * (dokładny archiwalny wyprzedza prefiks aktywnego). Sortowanie stabilne, grupy zostają w kolejności pierwszego wystąpienia.
 */
export function rankSearchResults(items: SearchResultItem[], cleanQuery: string, perGroup = SEARCH_GROUP_LIMIT): SearchResultItem[] {
  const groups = new Map<SearchCategoryKey, SearchResultItem[]>()
  for (const it of items) groups.set(it.category, [...(groups.get(it.category) ?? []), it])
  const key = (it: SearchResultItem) => matchScore(it, cleanQuery) * 2 + (it.archived ? 1 : 0)
  return [...groups.values()].flatMap((group) => [...group].sort((a, b) => key(a) - key(b)).slice(0, perGroup))
}
