import { Dumbbell, Utensils, Sparkles, Pill, ChevronRight } from "lucide-react";

type Status = "completed" | "upcoming" | "menu";

const allActivities = [
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
    tint: "bg-slate-100 text-slate-700",
  },
  {
    id: 3,
    icon: Utensils,
    title: "Zbilansowany obiad",
    time: "12:30",
    detail: "Grillowany łosoś, gotowane warzywa, komosa ryżowa i sałatka owocowa.",
    status: "menu" as Status,
    tint: "bg-blue-100 text-blue-800",
    isMenu: true
  },
  {
    id: 4,
    icon: Sparkles,
    title: "Sesja masażu",
    time: "14:00",
    detail: "Relaksacyjny masaż z aromaterapią w sali wellness.",
    status: "upcoming" as Status,
    tint: "bg-indigo-100 text-indigo-800",
  },
];

const statusStyles: Record<Status, { label: string; cls: string }> = {
  completed: { label: "Ukończono", cls: "bg-sage text-primary-foreground" },
  upcoming: { label: "Nadchodzi", cls: "bg-muted text-slate-soft" },
  menu: { label: "Wspólne", cls: "bg-blue-100 text-blue-800" },
};

function getIconForType(type: string) {
  switch (type?.toLowerCase()) {
    case 'meal': return Utensils;
    case 'medical': return Pill;
    case 'activity': return Dumbbell;
    default: return Sparkles;
  }
}

function getTintForType(type: string) {
  switch (type?.toLowerCase()) {
    case 'meal': return "bg-blue-100 text-blue-800";
    case 'medical': return "bg-slate-100 text-slate-700";
    case 'activity': return "bg-sage-soft text-sage-deep";
    default: return "bg-indigo-100 text-indigo-800";
  }
}

export function ServiceActivityFeed({ 
  compact = false, 
  showMenu = false, 
  agenda 
}: { 
  compact?: boolean, 
  showMenu?: boolean,
  agenda?: Array<{ id: string; title: string; time: string; type: string; resident_id: string | null }>
}) {
  let activities: Array<{
    id: string | number;
    icon: any;
    title: string;
    time: string;
    detail: string;
    status: Status;
    tint: string;
    isMenu?: boolean;
  }> = allActivities;
  
  if (agenda && agenda.length > 0) {
    activities = agenda.map(item => ({
      id: item.id,
      icon: getIconForType(item.type),
      title: item.title,
      time: item.time ? item.time.slice(0, 5) : item.time,
      detail: item.type === 'meal' ? "Jadłospis" : "Zaplanowane wydarzenie",
      status: (item.resident_id === null ? "menu" : "upcoming") as Status,
      tint: getTintForType(item.type),
      isMenu: item.resident_id === null
    }));
  }

  if (compact) {
    activities = activities.slice(0, 3);
  }
  
  if (!showMenu) {
    activities = activities.filter(a => !a.isMenu);
  }

  return (
    <div className="rounded-[1.75rem] bg-card p-6 ring-1 ring-border shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[1.25rem] text-slate font-display">Aktywność opieki</h3>
          <p className="text-[0.88rem] text-slate-soft">Dzisiejszy harmonogram opieki</p>
        </div>
        {compact && (
          <button className="flex items-center gap-1 rounded-full px-3 py-2 text-[0.9rem] text-sage-deep hover:bg-sage-soft/60 transition-colors">
            Zobacz agendę <ChevronRight className="h-4 w-4" />
          </button>
        )}
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
                    <p className="text-[1.05rem] text-slate font-medium">{a.title}</p>
                    <span className="text-[0.82rem] text-slate-soft">· {a.time}</span>
                  </div>
                  <p className="mt-0.5 text-[0.9rem] leading-relaxed text-slate-soft">{a.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[0.78rem] font-medium ${s.cls}`}>
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
