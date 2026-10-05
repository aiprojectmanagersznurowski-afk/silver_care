import { Dumbbell, Utensils, Sparkles, Pill, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";

type Status = "completed" | "upcoming" | "menu";

const statusStyles: Record<Status, { label: string; cls: string }> = {
  completed: { label: "Ukończono", cls: "bg-primary text-primary-foreground" },
  upcoming: { label: "Nadchodzi", cls: "bg-muted text-muted-foreground" },
  menu: { label: "Wspólne", cls: "bg-muted text-foreground" },
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
    case 'meal': return "bg-muted text-foreground";
    case 'medical': return "bg-muted text-foreground";
    case 'activity': return "bg-accent text-primary";
    default: return "bg-muted text-foreground";
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
  }> = [];
  
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

  if (!showMenu) {
    activities = activities.filter(a => !a.isMenu);
  }

  if (compact) {
    activities = activities.slice(0, 3);
  }

  return (
    <div className="rounded-[1.75rem] bg-card p-6 border border-border">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-[1.25rem] text-foreground font-display">Aktywność opieki</h3>
          <p className="text-[0.88rem] text-muted-foreground">Dzisiejszy harmonogram opieki</p>
        </div>
        {compact && (
          <Link 
            href="/agenda"
            className="flex items-center gap-1 rounded-full px-3 py-2 text-[0.9rem] text-primary font-medium hover:bg-accent/60 transition-colors"
          >
            Zobacz agendę <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-muted/50 rounded-xl">
          <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-2">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Brak zaplanowanych wydarzeń na dziś</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
            Harmonogram zajęć, posiłków i spacerów jest aktualizowany na bieżąco przez personel placówki.
          </p>
        </div>
      ) : (
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
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${a.tint}`}
                >
                  <a.icon className="h-6 w-6" />
                </div>
                <div className="flex flex-1 items-start justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[1.05rem] text-foreground font-medium">{a.title}</p>
                      <span className="text-[0.82rem] text-muted-foreground">· {a.time}</span>
                    </div>
                    <p className="mt-0.5 text-[0.9rem] leading-relaxed text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[0.78rem] font-medium ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
