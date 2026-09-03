import { useState } from "react";
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

const navItems = ["Pulpit", "Usługi", "Zdrowie", "Wiadomości"];

const seniors = [
  {
    id: "eleanor",
    name: "Katarzyna Wiśniewska",
    relation: "Mama · Willowbrook, apart. 12",
    img: "https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
  {
    id: "arthur",
    name: "Artur Bennett",
    relation: "Tata · Skrzydło Klonowe, pok. 4",
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
];

export function FamilyHeader() {
  const [active, setActive] = useState("Pulpit");
  const [current, setCurrent] = useState(seniors[0]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
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
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={`rounded-full px-5 py-2.5 transition-colors ${
                active === item
                  ? "bg-sage text-primary-foreground shadow-sm"
                  : "text-slate-soft hover:bg-sage-soft/60 hover:text-slate"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card text-slate-soft ring-1 ring-border transition-colors hover:text-slate">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[var(--chart-4)] ring-2 ring-card" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-full bg-card py-1.5 pl-1.5 pr-3 ring-1 ring-border transition-shadow hover:shadow-sm">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={current.img} alt={current.name} />
                  <AvatarFallback>{current.name[0]}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-[0.95rem] text-slate">{current.name}</p>
                  <p className="text-[0.72rem] text-slate-soft">Wyświetlany profil</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-soft" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-2xl p-2">
              <DropdownMenuLabel className="text-slate-soft">Zmień bliską osobę</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {seniors.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setCurrent(s)}
                  className="flex items-center gap-3 rounded-xl py-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={s.img} alt={s.name} />
                    <AvatarFallback>{s.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 leading-tight">
                    <p className="text-slate">{s.name}</p>
                    <p className="text-[0.75rem] text-slate-soft">{s.relation}</p>
                  </div>
                  {current.id === s.id && <Check className="h-4 w-4 text-sage" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
