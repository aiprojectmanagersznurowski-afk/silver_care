import Link from 'next/link'
import { LogOut, User } from 'lucide-react'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'

/** Stopka paska bocznego: zalogowane konto, link do profilu i wylogowanie (nav-user szablonu). */
export function SidebarAccount({ userEmail }: { userEmail?: string | null }) {
  return (
    <SidebarFooter>
      <SidebarMenu>
        {userEmail && (
          <SidebarMenuItem className="px-2 py-1 group-data-[collapsible=icon]:hidden">
            <span className="block text-xs text-muted-foreground">Zalogowano</span>
            <span className="block truncate text-sm font-medium">{userEmail}</span>
          </SidebarMenuItem>
        )}
        <SidebarMenuItem className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Motyw</span>
          <ThemeToggle />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link href="/settings/profile" />} tooltip="Profil i bezpieczeństwo">
            <User />
            <span>Profil i bezpieczeństwo</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <form action="/auth/signout" method="post">
            <SidebarMenuButton type="submit" tooltip="Wyloguj się">
              <LogOut />
              <span>Wyloguj się</span>
            </SidebarMenuButton>
          </form>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
