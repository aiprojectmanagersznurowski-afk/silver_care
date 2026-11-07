'use client'

import { Calendar, ClipboardList, FileText, Users, Mic } from 'lucide-react'
import Image from 'next/image'
import { Logo } from '@/components/Logo'
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
import { roleLabel } from '@/lib/auth/role-labels'

export function getStaffNavGroups(): SidebarNavGroup[] {
  return [
    {
      label: 'Dyżur',
      items: [
        { href: '/staff', label: 'Podopieczni', icon: Users, exact: true },
        { href: '/staff/agenda', label: 'Agenda na dziś', icon: Calendar },
        { href: '/staff/shift-tasks', label: 'Zadania zmiany', icon: ClipboardList },
        { href: '/voice', label: 'Notatka głosowa', icon: Mic },
        { href: '/staff/reports', label: 'Raporty', icon: FileText },
      ],
    },
  ]
}

export function StaffSidebar({ userEmail }: { userEmail: string | undefined }) {
  const groups = getStaffNavGroups()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/staff" aria-label="Silver Care — strona główna" />}>
              <Image src="/logo-mark.png" alt="" width={32} height={32} className="hidden size-8 object-contain group-data-[collapsible=icon]:block" />
              <Logo width={124} height={36} className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden" priority />
              <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Personel</Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav groups={groups} />
      </SidebarContent>
      <SidebarAccount userEmail={userEmail} roleLabel={roleLabel('nurse')} />
      <SidebarRail />
    </Sidebar>
  )
}
