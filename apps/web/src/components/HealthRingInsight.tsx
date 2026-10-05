import { Moon, Footprints, Heart, Activity } from "lucide-react";

interface HealthRingInsightProps {
  metrics: {
    steps?: number;
    sleep_hours?: number;
  };
}

export function HealthRingInsight({ metrics }: HealthRingInsightProps) {
  // Jeśli nie ma danych do wyświetlenia, to ich nie wyświetlaj
  if (!metrics || (metrics.steps === undefined && metrics.sleep_hours === undefined)) {
    return null;
  }

  // Wartości domyślne do kalkulacji kółek, jesli dane są obecne
  const maxSteps = 6000;
  const maxSleep = 8;
  const steps = metrics.steps || 0;
  const sleep = metrics.sleep_hours || 0;

  const stepsPct = Math.min((steps / maxSteps) * 100, 100);
  const sleepPct = Math.min((sleep / maxSleep) * 100, 100);

  return (
    <div className="flex flex-col rounded-[1.75rem] bg-card p-6 ring-1 ring-border">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-[1.15rem] text-foreground font-display">Aktywność i Zdrowie</h3>
          <p className="mt-0.5 text-[0.85rem] text-muted-foreground">Pomiary z opaski</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
          <Activity className="h-5 w-5" />
        </div>
      </div>

      {/* Rings visualization */}
      <div className="relative mx-auto flex h-48 w-48 items-center justify-center mb-6">
        {/* Sleep Ring (Outer) */}
        <svg className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="96" cy="96" r="82" fill="none" stroke="var(--color-sage-soft)" strokeWidth="14" />
          <circle
            cx="96"
            cy="96"
            r="82"
            fill="none"
            stroke="var(--color-sage)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 82}
            strokeDashoffset={(2 * Math.PI * 82) * (1 - sleepPct / 100)}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Steps Ring (Inner) */}
        <svg className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="96" cy="96" r="62" fill="none" stroke="var(--border)" strokeWidth="14" />
          <circle
            cx="96"
            cy="96"
            r="62"
            fill="none"
            stroke="var(--color-slate)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 62}
            strokeDashoffset={(2 * Math.PI * 62) * (1 - stepsPct / 100)}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="flex flex-col items-center">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
        </div>
      </div>

      <div className="mt-auto space-y-3">
        {metrics.sleep_hours !== undefined && (
          <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary">
                <Moon className="h-4 w-4" />
              </div>
              <span className="text-[0.95rem] text-primary font-medium">Sen</span>
            </div>
            <span className="text-[1.05rem] font-medium text-primary">{sleep}h</span>
          </div>
        )}

        {metrics.steps !== undefined && (
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-foreground">
                <Footprints className="h-4 w-4" />
              </div>
              <span className="text-[0.95rem] text-foreground font-medium">Kroki</span>
            </div>
            <span className="text-[1.05rem] font-medium text-foreground">{steps}</span>
          </div>
        )}
      </div>
    </div>
  );
}
