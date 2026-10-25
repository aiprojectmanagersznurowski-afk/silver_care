import React from 'react'
import {
  User,
  BedDouble,
  Calendar,
  FileText,
  Building2,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react'
import {
  SearchCategoryKey,
  SearchResultItem,
  SEARCH_CATEGORIES,
} from '@/lib/global-search-helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const CATEGORY_ICONS: Record<SearchCategoryKey, React.ComponentType<{ className?: string }>> = {
  residents: User,
  facility: BedDouble,
  agenda: Calendar,
  reports: FileText,
  staff: User,
  organizations: Building2,
}

interface CommandPaletteResultsProps {
  query: string
  isPending: boolean
  errorMessage: string | null
  results: SearchResultItem[]
  selectedIndex: number
  onSelectItem: (item: SearchResultItem) => void
  onHoverIndex: (idx: number) => void
  onRetry: () => void
  listboxId: string
  getOptionId: (idx: number) => string
}

/** Komunikat dla czytnika ekranu: liczba wyników z polską odmianą (1 wynik, 2–4 wyniki, 5+ wyników). */
export function describeResultCount(count: number): string {
  if (count === 1) return '1 wynik'
  const lastTwo = count % 100
  const last = count % 10
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? `${count} wyniki` : `${count} wyników`
}

function announcement(query: string, isPending: boolean, errorMessage: string | null, count: number): string {
  if (errorMessage) return errorMessage
  if (query.trim().length < 2) return ''
  if (isPending) return 'Szukanie…'
  return count === 0 ? 'Brak wyników' : describeResultCount(count)
}

export function CommandPaletteResults({
  query,
  isPending,
  errorMessage,
  results,
  selectedIndex,
  onSelectItem,
  onHoverIndex,
  onRetry,
  listboxId,
  getOptionId,
}: CommandPaletteResultsProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-84 sm:flex-none">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement(query, isPending, errorMessage, results.length)}
      </div>

      {/* Stan 1: Brak zapytania (podpowiedź startowa) */}
      {!query.trim() && (
        <div className="py-8 px-4 text-center space-y-2">
          <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium text-foreground">
            Szybkie przeszukiwanie placówki
          </div>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Wpisz co najmniej 2 znaki, aby odnaleźć podopiecznego, sprawdzić pokój i łóżko,
            przejrzeć plan dnia lub otworzyć raport dobowy.
          </p>
        </div>
      )}

      {/* Stan 2: Błąd */}
      {errorMessage && (
        <div role="alert" className="flex flex-col items-center gap-3 p-4 text-center text-sm text-destructive">
          <span>{errorMessage}</span>
          <Button type="button" variant="outline" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        </div>
      )}

      {/* Stan 3: Brak wyników */}
      {query.trim().length >= 2 && !isPending && results.length === 0 && !errorMessage && (
        <div className="py-8 px-4 text-center text-sm text-muted-foreground">
          Brak wyników pasujących do &quot;<strong className="text-foreground">{query}</strong>&quot;.
        </div>
      )}

      {/* Stan 4: Lista wyników */}
      {results.length > 0 && (
        <div role="listbox" id={listboxId} aria-label="Wyniki wyszukiwania" className="divide-y divide-border/60">
        {results.map((item, idx) => {
          const isSelected = idx === selectedIndex
          const IconComponent = CATEGORY_ICONS[item.category] || FileText

          return (
            <div
              key={`${item.category}-${item.id}`}
              id={getOptionId(idx)}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectItem(item)}
              onMouseEnter={() => onHoverIndex(idx)}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer min-h-touch ${
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
                      <Badge variant="outline" className="text-sm py-0 px-1.5 h-4">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-muted-foreground ml-3">
                <span className="text-sm hidden sm:inline uppercase tracking-wider font-medium">
                  {SEARCH_CATEGORIES[item.category]?.label}
                </span>
                {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-primary" />}
              </div>
            </div>
          )
        })}
        </div>
      )}
    </div>
  )
}
