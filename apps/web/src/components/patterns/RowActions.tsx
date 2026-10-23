'use client'

import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface RowAction {
  label: string
  icon?: LucideIcon
  /** Akcja w miejscu (np. otwarcie okna dialogowego); menu zamyka się samo. */
  onSelect?: () => void
  /** Przejście do innej strony zamiast akcji w miejscu. */
  href?: string
  disabled?: boolean
  /** Wyjaśnienie wyłączonej akcji albo dłuższy opis — jako podpowiedź. */
  hint?: string
  /** Kreska oddzielająca od poprzednich pozycji. */
  separated?: boolean
}

interface RowActionsProps {
  actions: RowAction[]
  /** Nagłówek menu, np. „Zarządzaj kontem". */
  label?: string
  /** Okna dialogowe sterowane z menu — renderowane obok, poza menu. */
  children?: ReactNode
}

/** Przycisk „⋯" otwierający menu akcji wiersza — także dla menu z własnym stanem (np. konta personelu). */
export function RowActionsTrigger() {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon"
          data-slot="row-actions"
          className="size-touch border-0 text-muted-foreground hover:text-foreground data-popup-open:bg-muted"
        />
      }
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Otwórz menu</span>
    </DropdownMenuTrigger>
  )
}

/**
 * Akcje wiersza jak w szablonie shadcn-admin: jeden przycisk „⋯" (ghost, ikona) rozwijający menu.
 * Ten sam komponent w każdej tabeli i w kafelkach obiektów.
 */
export function RowActions({ actions, label = 'Akcje', children }: RowActionsProps) {
  if (actions.length === 0) return <>{children}</>

  return (
    <>
      <DropdownMenu>
        <RowActionsTrigger />
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map(({ label: text, icon: Icon, onSelect, href, disabled, hint, separated }) => (
            <Fragment key={text}>
              {separated && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={disabled}
                title={hint}
                onClick={onSelect}
                className="min-h-touch cursor-pointer"
                render={href ? <Link href={href} /> : undefined}
              >
                {Icon && <Icon />}
                {text}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {children}
    </>
  )
}
