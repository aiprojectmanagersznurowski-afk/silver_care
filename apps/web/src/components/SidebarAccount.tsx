import { LogOut } from 'lucide-react'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

/** Stopka paska bocznego: zalogowane konto i wylogowanie (nav-user szablonu). */
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
        <SidebarMenuItem>
          <form action="/auth/signout" method="post">
            <SidebarMenuButton type="submit" tooltip="Wyloguj się" className="text-destructive hover:text-destructive">
              <LogOut />
              <span>Wyloguj się</span>
            </SidebarMenuButton>
          </form>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
