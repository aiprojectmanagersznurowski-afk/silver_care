import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'

interface AppHeaderProps {
  /** Wyszukiwarka globalna (GlobalCommandPalette) — po lewej, jak w szablonie. */
  search: ReactNode
  /** Akcje po prawej przed przełącznikiem motywu (np. dzwonek powiadomień). */
  actions?: ReactNode
}

/**
 * Nagłówek powłoki z szablonu shadcn-admin, wspólny dla panelu administratora i personelu:
 * zwijanie paska bocznego, separator i wyszukiwarka po lewej; akcje i motyw po prawej.
 */
export function AppHeader({ search, actions }: AppHeaderProps) {
  return (
    <header data-slot="app-header" className="flex h-12 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div data-slot="app-header-start" className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1 min-h-touch min-w-touch" aria-label="Zwiń lub rozwiń menu" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
          {search}
        </div>
        <div data-slot="app-header-end" className="flex items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
