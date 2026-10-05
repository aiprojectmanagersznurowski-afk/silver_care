'use client'

import { Calendar, FileText, MessageSquare, Users } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { SidebarNav, type SidebarNavGroup } from '@/components/SidebarNav'
import { SidebarAccount } from '@/components/SidebarAccount'

const STAFF_GROUPS: SidebarNavGroup[] = [
  {
    label: 'Dyżur',
    items: [
      { href: '/staff', label: 'Podopieczni', icon: Users, exact: true },
      { href: '/staff/agenda', label: 'Agenda na dziś', icon: Calendar },
      { href: '/staff/reports', label: 'Raporty', icon: FileText },
      { href: '/staff/messages', label: 'Wiadomości', icon: MessageSquare },
    ],
  },
]

export function StaffSidebar({ userEmail }: { userEmail: string | undefined }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/staff" aria-label="Silver Care — strona główna" />}>
              <Image src="/logo-mark.png" alt="" width={32} height={32} className="hidden size-8 object-contain group-data-[collapsible=icon]:block" />
              <Image src="/logo.png" alt="Silver Care" width={124} height={36} className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden" priority />
              <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Personel</Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav groups={STAFF_GROUPS} />
      </SidebarContent>
      <SidebarAccount userEmail={userEmail} />
      <SidebarRail />
    </Sidebar>
  )
}
