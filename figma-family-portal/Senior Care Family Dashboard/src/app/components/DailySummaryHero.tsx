import { Sparkles, CheckCircle2, Sun, Footprints } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const moods = [
  { emoji: "😊", label: "Radosny", active: true },
  { emoji: "😐", label: "Spokojny", active: false },
  { emoji: "😴", label: "Zmęczony", active: false },
];

const quickStats = [
  { icon: CheckCircle2, label: "Ukończone zajęcia", value: "5 z 6" },
  { icon: Footprints, label: "Kroki dzisiaj", value: "2 140" },
  { icon: Sun, label: "Czas na dworze", value: "45 min" },
];

function WellbeingRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="12" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="#fffdf8"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground">
        <span style={{ fontFamily: "var(--font-display)" }} className="text-[2.4rem] leading-none">
          {score}
        </span>
        <span className="text-[0.8rem] opacity-90">na 100</span>
      </div>
    </div>
  );
}

export function DailySummaryHero() {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* Well-being card */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-sage p-7 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <p className="text-[0.95rem] opacity-90">Dzisiaj · piątek, 3 lipca</p>
          </div>

          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <WellbeingRing score={88} />
            <div className="flex-1">
              <h2 className="text-[1.4rem] text-primary-foreground sm:text-[1.6rem]">Dzisiejsze samopoczucie</h2>
              <p className="mx-auto mt-1 max-w-md text-[0.95rem] leading-relaxed opacity-90 sm:mx-0 sm:text-[1rem]">
                Katarzyna ma wspaniały, aktywny dzień. Jest w pogodnym nastroju, a poranna opieka
                przebiegła bez zakłóceń.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
                <span className="text-[2rem] leading-none">😊</span>
                <div className="text-left">
                  <p className="text-[0.8rem] uppercase tracking-wide opacity-80">Aktualny nastrój</p>
                  <p className="text-[1.15rem]">Radosny</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            {quickStats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm"
              >
                <s.icon className="h-5 w-5" />
                <div className="leading-tight">
                  <p className="text-[1.05rem]">{s.value}</p>
                  <p className="text-[0.78rem] opacity-85">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mood check-in card */}
      <div className="flex flex-col rounded-[1.75rem] bg-card p-6 ring-1 ring-border">
        <div className="mb-4 overflow-hidden rounded-2xl">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
            alt="Katarzyna podczas popołudnia"
            className="h-36 w-full object-cover"
          />
        </div>
        <h3 className="text-[1.15rem] text-slate">Jak czuje się Katarzyna?</h3>
        <p className="mt-1 text-[0.9rem] text-slate-soft">Zapisane przez opiekuna o 9:15</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {moods.map((m) => (
            <div
              key={m.label}
              className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors ${
                m.active
                  ? "bg-sage-soft ring-2 ring-sage"
                  : "bg-muted/60 ring-1 ring-border"
              }`}
            >
              <span className="text-[1.75rem] leading-none">{m.emoji}</span>
              <span className="text-[0.82rem] text-slate">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
