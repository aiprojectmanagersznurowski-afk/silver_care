import { Dumbbell, UtensilsCrossed, Sparkles, Pill, ChevronRight } from "lucide-react";

type Status = "completed" | "upcoming" | "menu";

const activities = [
  {
    id: 1,
    icon: Dumbbell,
    title: "Poranna rehabilitacja",
    time: "08:30 – 09:15",
    detail: "Ćwiczenia mobilności i lekkiego wzmacniania z terapeutką Daną.",
    status: "completed" as Status,
    tint: "bg-sage-soft text-sage-deep",
  },
  {
    id: 2,
    icon: Pill,
    title: "Podanie leków",
    time: "10:00",
    detail: "Poranne tabletki przyjęte z wodą. Bez uwag.",
    status: "completed" as Status,
    tint: "bg-[#eef2f7] text-[#4f6f8f]",
  },
  {
    id: 3,
    icon: UtensilsCrossed,
    title: "Zbilansowany obiad",
    time: "12:30",
    detail: "Grillowany łosoś, gotowane warzywa, komosa ryżowa i sałatka owocowa.",
    status: "menu" as Status,
    tint: "bg-[#dceaf6] text-[#3f74b0]",
  },
  {
    id: 4,
    icon: Sparkles,
    title: "Sesja masażu",
    time: "14:00",
    detail: "Relaksacyjny masaż z aromaterapią w sali wellness.",
    status: "upcoming" as Status,
    tint: "bg-[#e6ecf7] text-[#5a6bad]",
  },
];

const statusStyles: Record<Status, { label: string; cls: string }> = {
  completed: { label: "Ukończono", cls: "bg-sage text-primary-foreground" },
  upcoming: { label: "14:00", cls: "bg-muted text-slate-soft" },
  menu: { label: "Menu w załączniku", cls: "bg-[#dceaf6] text-[#3f74b0]" },
};

export function ServiceActivityFeed() {
  return (
    <div className="rounded-[1.75rem] bg-card p-6 ring-1 ring-border">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[1.25rem] text-slate">Aktywność opieki</h3>
          <p className="text-[0.88rem] text-slate-soft">Dzisiejszy harmonogram opieki</p>
        </div>
        <button className="flex items-center gap-1 rounded-full px-3 py-2 text-[0.9rem] text-sage-deep hover:bg-sage-soft/60">
          Zobacz wszystko <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <ol className="relative space-y-2">
        {activities.map((a, i) => {
          const s = statusStyles[a.status];
          return (
            <li key={a.id} className="relative flex gap-4">
              {/* connector */}
              {i !== activities.length - 1 && (
                <span className="absolute left-[27px] top-[56px] h-[calc(100%-40px)] w-px bg-border" />
              )}
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${a.tint}`}
              >
                <a.icon className="h-6 w-6" />
              </div>
              <div className="flex flex-1 items-start justify-between gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-muted/40">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[1.05rem] text-slate">{a.title}</p>
                    <span className="text-[0.82rem] text-slate-soft">· {a.time}</span>
                  </div>
                  <p className="mt-0.5 text-[0.9rem] leading-relaxed text-slate-soft">{a.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[0.78rem] ${s.cls}`}>
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
