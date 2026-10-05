'use client'

import {
  BarChart3,
  Building2,
  CalendarDays,
  LayoutDashboard,
  Mail,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
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

// Globalne linki Super Admina (zarządzanie całą platformą)
const PLATFORM_GROUP: SidebarNavGroup = {
  label: 'Zarządzanie platformą',
  items: [
    { href: '/admin/organizations', label: 'Placówki', icon: Building2 },
    { href: '/admin/iam', label: 'Uprawnienia (IAM)', icon: ShieldCheck },
    { href: '/admin/audit', label: 'Rejestr audytowy', icon: ShieldAlert },
  ],
}

// Linki operacyjne placówki (admin placówki albo Super Admin w trybie podglądu)
function facilityGroup(isImpersonating: boolean): SidebarNavGroup {
  return {
    label: isImpersonating ? 'Operacje placówki (podgląd)' : 'Placówka',
    items: [
      { href: '/admin', label: 'Pulpit placówki', icon: LayoutDashboard, exact: true },
      { href: '/admin/facility', label: 'Struktura placówki', icon: Building2 },
      { href: '/admin/residents', label: 'Podopieczni', icon: Users },
      { href: '/admin/staff', label: 'Personel', icon: UserPlus },
      { href: '/admin/invitations', label: 'Zaproszenia', icon: Mail },
      {
        href: '/admin/reports',
        label: 'Analiza',
        icon: TrendingUp,
        children: [
          { href: '/admin/reports/daily', label: 'Dane dzienne', icon: CalendarDays },
          { href: '/admin/reports/statistics', label: 'Statystyka', icon: BarChart3 },
        ],
      },
      { href: '/admin/audit', label: 'Rejestr placówki', icon: ShieldAlert },
    ],
  }
}

export function AdminSidebar({
  userEmail,
  role,
  isImpersonating = false,
}: {
  userEmail: string
  role?: string
  isImpersonating?: boolean
}) {
  const showPlatform = role === 'super_admin' && !isImpersonating
  const groups = showPlatform ? [PLATFORM_GROUP] : [facilityGroup(isImpersonating)]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" aria-label="Silver Care — strona główna" />}>
              <Image src="/logo-mark.png" alt="" width={32} height={32} className="hidden size-8 object-contain group-data-[collapsible=icon]:block" />
              <Image src="/logo.png" alt="Silver Care" width={124} height={36} className="h-7 w-auto object-contain group-data-[collapsible=icon]:hidden" priority />
              <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">{role === 'super_admin' ? 'Super Admin' : 'Admin'}</Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav groups={groups} />
      </SidebarContent>
      <SidebarAccount userEmail={userEmail} />
      <SidebarRail />
    </Sidebar>
  )
}
