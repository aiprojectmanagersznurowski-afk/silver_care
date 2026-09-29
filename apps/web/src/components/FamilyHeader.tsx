'use client'

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Bell, Check, LayoutDashboard, Calendar, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const navItems = [
  { label: "Pulpit", href: "/dashboard", icon: LayoutDashboard },
  { label: "Plan Dnia", href: "/agenda", icon: Calendar },
  { label: "Wiadomości", href: "/messages", icon: MessageSquare },
];

interface Resident {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export function FamilyHeader({ residents }: { residents: Resident[] }) {
  const pathname = usePathname();
  const router = useRouter();

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
    if (typeof document !== 'undefined') {
      document.cookie = `family_resident_id=${s.id}; path=/; max-age=31536000`;
    }
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="Silver Care"
              width={140}
              height={40}
              className="h-8 sm:h-9 w-auto object-contain"
              priority
            />
            <span className="hidden text-[0.8rem] text-slate-soft sm:inline-block border-l border-slate/15 pl-3">
              Portal rodzinnej opieki
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-full px-5 py-2.5 transition-colors text-sm font-medium ${
                    isActive
                      ? "bg-sage text-primary-foreground shadow-sm"
                      : "text-slate-soft hover:bg-sage-soft/60 hover:text-slate"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card text-slate-soft ring-1 ring-border transition-colors hover:text-slate hover:shadow-sm">
                <Bell className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
                <DropdownMenuLabel className="text-slate-soft">Powiadomienia</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="py-5 text-center text-[0.85rem] text-slate-soft">
                  Brak nowych powiadomień
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {current ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 rounded-full bg-card py-1.5 pl-1.5 pr-3 ring-1 ring-border transition-shadow hover:shadow-sm">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={current.avatar_url || ""} alt={`${current.first_name} ${current.last_name}`} />
                    <AvatarFallback>{current.first_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left leading-tight sm:block">
                    <p className="text-[0.95rem] text-slate">{current.first_name} {current.last_name}</p>
                    <p className="text-[0.72rem] text-slate-soft">Wyświetlany profil</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-soft" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-2xl p-2">
                  <DropdownMenuLabel className="text-slate-soft">Zmień bliską osobę</DropdownMenuLabel>
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
                        <p className="text-slate">{s.first_name} {s.last_name}</p>
                      </div>
                      {current.id === s.id && <Check className="h-4 w-4 text-sage" />}
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
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
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-card py-2 px-4 ring-1 ring-border text-slate-soft hover:text-slate">
                  <span className="text-sm font-medium">Konto</span>
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                  <DropdownMenuLabel className="text-slate-soft">Profil rodziny</DropdownMenuLabel>
                  <DropdownMenuSeparator />
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

      {/* Mobile Bottom Navigation Bar (Dead End #1 Fix) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/80 bg-cream/95 py-2 px-2 backdrop-blur-lg shadow-lg md:hidden">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard');
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-medium transition-colors ${
                isActive 
                  ? "text-sage font-bold bg-sage-soft/60" 
                  : "text-slate-soft hover:text-slate"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-sage" : "text-slate-soft"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
