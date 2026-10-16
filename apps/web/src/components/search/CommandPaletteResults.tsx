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
}

export function CommandPaletteResults({
  query,
  isPending,
  errorMessage,
  results,
  selectedIndex,
  onSelectItem,
  onHoverIndex,
}: CommandPaletteResultsProps) {
  return (
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
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Wpisz co najmniej 2 znaki, aby odnaleźć podopiecznego, sprawdzić pokój i łóżko,
            przejrzeć plan dnia lub otworzyć raport dobowy.
          </p>
        </div>
      )}

      {/* Stan 2: Błąd */}
      {errorMessage && (
        <div className="p-4 text-center text-sm text-destructive">
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
              onClick={() => onSelectItem(item)}
              onMouseEnter={() => onHoverIndex(idx)}
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
  )
}
