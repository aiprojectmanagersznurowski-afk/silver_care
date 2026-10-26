'use client'

import Link from 'next/link'
import { Check, ChevronDown, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatPersonName } from '@/lib/person-name'

export interface FamilyResident {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
}

interface FamilyAccountMenuProps {
  residents: FamilyResident[]
  current?: FamilyResident
  onSelect: (resident: FamilyResident) => void
}

const TRIGGER = 'flex h-touch items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Menu konta w nagłówku portalu rodziny: wybór bliskiej osoby, profil i wylogowanie. */
export function FamilyAccountMenu({ residents, current, onSelect }: FamilyAccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER}>
        {current ? (
          <>
            <Avatar className="size-7">
              <AvatarImage src={current.avatar_url || ''} alt={formatPersonName(current.first_name, current.last_name)} />
              <AvatarFallback>{current.first_name[0]}</AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium text-foreground">{formatPersonName(current.first_name, current.last_name)}</p>
              <p className="text-xs text-muted-foreground">Wyświetlany profil</p>
            </div>
          </>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Konto</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {current && (
          <>
            <DropdownMenuLabel className="text-muted-foreground">Zmień bliską osobę</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {residents.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onSelect(s)} className="flex cursor-pointer items-center gap-3">
                <Avatar className="size-7">
                  <AvatarImage src={s.avatar_url || ''} alt={formatPersonName(s.first_name, s.last_name)} />
                  <AvatarFallback>{s.first_name[0]}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-foreground">{formatPersonName(s.first_name, s.last_name)}</span>
                {current.id === s.id && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className="flex w-full cursor-pointer items-center gap-2.5" render={<Link href="/settings/profile" />}>
          <User className="size-4 text-muted-foreground" />
          <span>Profil i bezpieczeństwo</span>
        </DropdownMenuItem>
        <form action="/auth/signout" method="post" className="w-full">
          <DropdownMenuItem nativeButton className="flex w-full cursor-pointer items-center text-left" render={<button type="submit" />}>
            Wyloguj się
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
