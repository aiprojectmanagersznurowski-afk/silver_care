'use client'

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "./Logo";
import { useFamilyUnreadMessages } from "@/hooks/useFamilyUnreadMessages";
import { ChevronDown, Bell, Check, LayoutDashboard, Calendar, MessageSquare, User, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ThemeToggle } from "./ThemeToggle";
import { FamilyNotificationsDropdownContent } from "./family/FamilyNotificationsDropdownContent";

const navItems = [
  { label: "Pulpit", href: "/dashboard", icon: LayoutDashboard },
  { label: "Plan Dnia", href: "/agenda", icon: Calendar },
  { label: "Wiadomości", href: "/messages", icon: MessageSquare },
  { label: "Zgody", href: "/consents", icon: ShieldCheck },
];

interface Resident {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

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
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Logo
              width={140}
              height={40}
              className="h-8 sm:h-9 w-auto object-contain"
              priority
            />
            <span className="hidden text-sm text-muted-foreground xl:inline-block border-l border-border pl-3">
              Portal rodzinnej opieki
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
              const isMessages = item.href === '/messages';
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`inline-flex items-center rounded-full px-5 py-2.5 transition-colors text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  {isMessages && unreadCount > 0 && (
                    <span
                      data-testid="family-nav-messages-badge"
                      className="ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-sm font-bold text-destructive-foreground animate-pulse"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle className="h-11 w-11 rounded-full bg-card ring-1 ring-border text-muted-foreground hover:text-foreground" />
            
            {/* Dzwonek powiadomień */}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="family-notifications-bell"
                aria-label="Powiadomienia i wiadomości"
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus:outline-none"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span
                    data-testid="family-notifications-badge"
                    className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-sm font-bold text-destructive-foreground ring-2 ring-background animate-pulse"
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

            {current ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 rounded-full bg-card py-1.5 pl-1.5 pr-3 ring-1 ring-border transition-shadow">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={current.avatar_url || ""} alt={`${current.first_name} ${current.last_name}`} />
                    <AvatarFallback>{current.first_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left leading-tight sm:block">
                    <p className="text-[0.95rem] text-foreground">{current.first_name} {current.last_name}</p>
                    <p className="text-sm text-muted-foreground">Wyświetlany profil</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-xl p-2">
                  <DropdownMenuLabel className="text-muted-foreground">Zmień bliską osobę</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {residents.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      className="flex items-center gap-3 rounded-xl py-2.5 cursor-pointer"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.avatar_url || ""} alt={`${s.first_name} ${s.last_name}`} />
                        <AvatarFallback>{s.first_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 leading-tight">
                        <p className="text-foreground">{s.first_name} {s.last_name}</p>
                      </div>
                      {current.id === s.id && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex w-full cursor-pointer items-center gap-2.5 py-2.5 text-left font-medium text-foreground"
                    render={<Link href="/settings/profile" />}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Profil i bezpieczeństwo</span>
                  </DropdownMenuItem>
                  <form action="/auth/signout" method="post" className="w-full">
                    <DropdownMenuItem 
                      nativeButton
                      className="flex w-full cursor-pointer items-center py-2.5 text-left font-medium text-destructive focus:bg-destructive/10" 
                      render={<button type="submit" />}
                    >
                      Wyloguj się
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-card py-2 px-4 ring-1 ring-border text-muted-foreground hover:text-foreground">
                  <span className="text-sm font-medium">Konto</span>
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                  <DropdownMenuLabel className="text-muted-foreground">Profil rodziny</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex w-full cursor-pointer items-center gap-2.5 py-2.5 text-left font-medium text-foreground"
                    render={<Link href="/settings/profile" />}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Profil i bezpieczeństwo</span>
                  </DropdownMenuItem>
                  <form action="/auth/signout" method="post" className="w-full">
                    <DropdownMenuItem 
                      nativeButton
                      className="flex w-full cursor-pointer items-center py-2.5 text-left font-medium text-destructive focus:bg-destructive/10" 
                      render={<button type="submit" />}
                    >
                      Wyloguj się
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Bottom Navigation Bar (Dead End #1 Fix: tablet coverage up to lg breakpoint) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/80 bg-background/95 py-2 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-lg shadow-lg lg:hidden">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive 
                  ? "text-primary font-bold bg-accent/60" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.href === '/messages' && unreadCount > 0 && (
                  <span
                    data-testid="family-mobile-messages-badge"
                    className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background animate-pulse"
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
