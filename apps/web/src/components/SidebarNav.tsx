'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

export interface SidebarNavItem {
  href: string
  label: string
  icon: LucideIcon | React.ComponentType<{ className?: string }> | string
  /** Dokładne dopasowanie ścieżki — dla pozycji-korzeni jak /admin czy /staff. */
  exact?: boolean
  badge?: string | number
  children?: Omit<SidebarNavItem, 'children'>[]
}

export interface SidebarNavGroup {
  label?: string
  items: SidebarNavItem[]
}

function isActivePath(pathname: string, item: Pick<SidebarNavItem, 'href' | 'exact'>) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavIcon({
  icon: Icon,
  className = 'size-4 shrink-0',
}: {
  icon: SidebarNavItem['icon']
  className?: string
}) {
  if (typeof Icon === 'string') {
    return (
      <span className="text-base leading-none" aria-hidden="true">
        {Icon}
      </span>
    )
  }
  return <Icon className={className} />
}

function CollapsibleNavItem({
  item,
  pathname,
  onLinkClick,
}: {
  item: SidebarNavItem
  pathname: string
  onLinkClick: () => void
}) {
  const isAnyChildActive = Boolean(
    item.children?.some((child) => isActivePath(pathname, child)),
  )
  const [prevPathname, setPrevPathname] = useState(pathname)
  const [open, setOpen] = useState(isAnyChildActive)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (isAnyChildActive) {
      setOpen(true)
    }
  }

  if (!item.children) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        render={<SidebarMenuButton tooltip={item.label} />}
        className="group/collapsible"
      >
        <NavIcon icon={item.icon} />
        <span>{item.label}</span>
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.children.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton
                isActive={isActivePath(pathname, child)}
                render={<Link href={child.href} onClick={onLinkClick} />}
                onClick={onLinkClick}
              >
                <NavIcon icon={child.icon} />
                <span>{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Nawigacja paska bocznego w układzie szablonu shadcn-admin (nav-main). */
export function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <nav aria-label="Nawigacja główna">
      {groups.map((group, index) => (
        <SidebarGroup key={group.label ?? index}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarMenu>
            {group.items.map((item) =>
              item.children ? (
                <CollapsibleNavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onLinkClick={handleLinkClick}
                />
              ) : (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActivePath(pathname, item)}
                    tooltip={item.label}
                    render={<Link href={item.href} onClick={handleLinkClick} />}
                    onClick={handleLinkClick}
                  >
                    <div className="relative flex items-center justify-center">
                      <NavIcon icon={item.icon} />
                      {item.badge !== undefined && (
                        <span className="hidden group-data-[collapsible=icon]:block absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary ring-1 ring-background" />
                      )}
                    </div>
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badge !== undefined && (
                    <SidebarMenuBadge
                      data-testid="sidebar-nav-badge"
                      className="bg-primary/15 text-primary font-semibold border border-primary/25 tabular-nums"
                    >
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  )
}
