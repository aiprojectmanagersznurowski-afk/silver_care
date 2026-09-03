'use client'

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HeartHandshake, ChevronDown, Bell, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const navItems = ["Pulpit", "Plan Dnia", "Wiadomości"];

interface Resident {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export function FamilyHeader({ residents }: { residents: Resident[] }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState<Resident>(residents[0]);

  if (!current) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage text-primary-foreground shadow-sm sm:h-11 sm:w-11">
            <HeartHandshake className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="leading-tight">
            <p style={{ fontFamily: "var(--font-display)" }} className="text-[1.15rem] text-slate sm:text-[1.35rem]">
              Silver Care
            </p>
            <p className="hidden text-[0.8rem] text-slate-soft sm:block">Portal rodzinnej opieki</p>
          </div>
        </div>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const href = item === "Pulpit" ? "/dashboard" : item === "Plan Dnia" ? "/agenda" : "/messages";
            const isActive = pathname?.startsWith(href) || (pathname === '/' && href === '/dashboard');
            return (
              <a
                key={item}
                href={href}
                className={`rounded-full px-5 py-2.5 transition-colors ${
                  isActive
                    ? "bg-sage text-primary-foreground shadow-sm"
                    : "text-slate-soft hover:bg-sage-soft/60 hover:text-slate"
                }`}
              >
                {item}
              </a>
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
                  onClick={() => setCurrent(s)}
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
                  className="py-2.5 cursor-pointer w-full text-left text-destructive font-medium" 
                  render={<button type="submit" />}
                >
                  Wyloguj się
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
