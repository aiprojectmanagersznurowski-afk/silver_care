'use client'

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";
import { useFamilyUnreadMessages } from "@/hooks/useFamilyUnreadMessages";
import { Bell, LayoutDashboard, Calendar, MessageSquare, ShieldCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { FamilyAccountMenu, type FamilyResident } from "./family/FamilyAccountMenu";
import { ThemeToggle } from "./ThemeToggle";
import { FamilyNotificationsDropdownContent } from "./family/FamilyNotificationsDropdownContent";

const navItems = [
  { label: "Pulpit", href: "/dashboard", icon: LayoutDashboard },
  { label: "Plan Dnia", href: "/agenda", icon: Calendar },
  { label: "Wiadomości", href: "/messages", icon: MessageSquare },
  { label: "Zgody", href: "/consents", icon: ShieldCheck },
];

type Resident = FamilyResident;

function setResidentCookie(id: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `family_resident_id=${id}; path=/; max-age=31536000`;
  }
}

export function FamilyHeader({ residents }: { residents: Resident[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount, recentReplies, markAllAsRead } = useFamilyUnreadMessages();

  const [current, setCurrent] = useState<Resident | undefined>(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)family_resident_id=([^;]+)/);
      if (match) {
        const found = residents.find(r => r.id === match[1]);
        if (found) return found;
      }
    }
    return residents[0];
  });

  const handleSelect = (s: Resident) => {
    setCurrent(s);
    setResidentCookie(s.id);
    router.refresh();
  };

  return (
    <>
      <header data-slot="family-header" className="sticky top-0 z-30 h-12 shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-4 px-4 lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Logo
              width={140}
              height={40}
              className="h-7 w-auto object-contain"
              priority
            />
            <span className="hidden text-sm text-muted-foreground xl:inline-block border-l border-border pl-3">
              Portal rodzinnej opieki
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="ml-2 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
              const isMessages = item.href === '/messages';
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex h-touch items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{item.label}</span>
                  {isMessages && unreadCount > 0 && (
                    <span
                      data-testid="family-nav-messages-badge"
                      className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-medium text-primary-foreground"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            
            {/* Dzwonek powiadomień */}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="family-notifications-bell"
                aria-label="Powiadomienia i wiadomości"
                className="relative flex size-touch items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span
                    data-testid="family-notifications-badge"
                    className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-medium text-primary-foreground ring-2 ring-background"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <FamilyNotificationsDropdownContent
                unreadCount={unreadCount}
                recentReplies={recentReplies}
                markAllAsRead={markAllAsRead}
              />
            </DropdownMenu>

            <FamilyAccountMenu residents={residents} current={current} onSelect={handleSelect} />
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Bottom Navigation Bar (Dead End #1 Fix: tablet coverage up to lg breakpoint) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background py-2 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] lg:hidden">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-1.5 text-sm font-medium min-h-touch min-w-touch transition-colors ${
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                {item.href === '/messages' && unreadCount > 0 && (
                  <span
                    data-testid="family-mobile-messages-badge"
                    className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                  />
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
