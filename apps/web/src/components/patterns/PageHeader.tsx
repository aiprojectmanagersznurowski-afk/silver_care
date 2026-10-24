import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Przyciski akcji strony, wyrównane do prawej od szerokości sm. */
  actions?: ReactNode
  back?: { href: string; label: string }
  className?: string
}

/**
 * Wspólny nagłówek strony (ADR-017): jedyny h1 widoku, jedna typografia tytułu
 * i opisu na wszystkich ekranach. Nowy ekran używa tego komponentu zamiast własnego h2.
 */
export function PageHeader({ title, description, actions, back, className }: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}
    >
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            data-slot="page-header-back"
            className="mb-1 inline-flex min-h-touch items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {back.label}
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p data-slot="page-header-description" className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div data-slot="page-header-actions" className="flex flex-wrap items-center gap-2 sm:gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}

/** Informacja w miejscu akcji, gdy są wyłączone (np. tryb podglądu w impersonacji). */
export function PageHeaderNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground">
      <span>{children}</span>
    </div>
  )
}
