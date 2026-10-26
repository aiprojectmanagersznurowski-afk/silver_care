'use client'

import Link from 'next/link'
import { EllipsisVertical, LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const initialsOf = (email: string) => email.slice(0, 2).toUpperCase()

function AccountIdentity({ email, roleLabel }: { email: string; roleLabel: string }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-muted text-foreground">{initialsOf(email)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{email}</span>
        <span data-slot="nav-user-role" className="truncate text-xs text-muted-foreground">{roleLabel}</span>
      </div>
    </>
  )
}

/**
 * Stopka paska bocznego jak nav-user szablonu shadcn-admin: konto jako jeden przycisk,
 * który rozwija menu z profilem i wylogowaniem.
 */
export function SidebarAccount({ userEmail, roleLabel }: { userEmail?: string | null; roleLabel: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const email = userEmail || 'Konto'

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton size="lg" tooltip={email} className="data-popup-open:bg-sidebar-accent" />}
            >
              <span data-slot="nav-user-trigger" className="flex min-w-0 flex-1 items-center gap-2">
                <AccountIdentity email={email} roleLabel={roleLabel} />
              </span>
              <EllipsisVertical className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56" side={isMobile ? 'bottom' : 'right'} align="end">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <AccountIdentity email={email} roleLabel={roleLabel} />
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                render={<Link href="/settings/profile" onClick={() => isMobile && setOpenMobile(false)} />}
              >
                <User />
                Profil i bezpieczeństwo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <DropdownMenuItem nativeButton className="w-full cursor-pointer" render={<button type="submit" />}>
                  <LogOut />
                  Wyloguj się
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
