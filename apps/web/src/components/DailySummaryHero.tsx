import { Sparkles, CheckCircle2, Sun, Footprints, Camera } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

function deriveWellbeing(text?: string) {
  if (!text) return { sleep: "Brak danych", appetite: "Brak danych", mood: "Brak danych", moodEmoji: "😐" };
  const lower = text.toLowerCase();
  let sleep = "W normie";
  let appetite = "W normie";
  let mood = "Spokojny";
  let moodEmoji = "😐";

  if (lower.includes("sen") || lower.includes("spa") || lower.includes("noc")) {
    if (lower.match(/(dobrze|spokojnie|przespa|długo)/)) sleep = "Dobry";
    else if (lower.match(/(wybudza|zły|niespokojny|nie spa|przerwa)/)) sleep = "Przerywany";
  }
  if (lower.includes("apetyt") || lower.includes("jad") || lower.includes("posił") || lower.includes("obiad")) {
    if (lower.match(/(dopisywał|chętnie|cały|smakiem|bardzo dobry|dobry)/)) appetite = "Bardzo dobry";
    else if (lower.match(/(brak|nie chcia|mało|odmówi|słaby)/)) appetite = "Słaby";
  }
  if (lower.match(/(nastr|humor|samopoczucie|czuje)/)) {
    if (lower.match(/(dobrym|świetnym|pogodny|uśmiechnię|wesoł|dobrze)/)) { mood = "Radosny"; moodEmoji = "😊"; }
    else if (lower.match(/(smutn|apatyczn|zdenerwowan|zły|niespokojn|pobudzon|napięt|płacz)/)) { mood = "Obniżony"; moodEmoji = "😔"; }
  } else {
    if (lower.match(/(pogodny|uśmiechnięt|wesoł|zadowolon)/)) { mood = "Radosny"; moodEmoji = "😊"; }
    if (lower.match(/(smutn|apatyczn|zdenerwowan|pobudzon)/)) { mood = "Obniżony"; moodEmoji = "😔"; }
  }

  return { sleep, appetite, mood, moodEmoji };
}

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
          stroke="currentColor"
          className="text-cream"
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

export function DailySummaryHero({ resident, report }: { resident: any, report: any }) {
  const reportText = report?.content?.text || 'Brak dzisiejszego raportu od personelu. Czekamy na pierwsze wpisy.';
  const wb = deriveWellbeing(reportText);

  const quickStats = [
    { icon: CheckCircle2, label: "Sen", value: wb.sleep },
    { icon: Footprints, label: "Kroki dzisiaj", value: report?.content?.metrics?.steps ? `${report.content.metrics.steps}` : "Brak opaski" },
    { icon: Sun, label: "Apetyt", value: wb.appetite },
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* Well-being card */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-sage p-7 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <p className="text-[0.95rem] opacity-90">Dzisiaj · {format(new Date(), 'EEEE, d MMMM', { locale: pl })}</p>
            </div>
            {report && (
              <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-white/20">
                Opublikowano {format(new Date(report.created_at), 'HH:mm')}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
            <WellbeingRing score={wb.mood === "Radosny" ? 95 : wb.mood === "Obniżony" ? 65 : 82} />
            <div className="flex-1">
              <h2 className="text-[1.4rem] text-primary-foreground sm:text-[1.6rem]">Podsumowanie Dnia</h2>
              {/* Więcej miejsca na notatki glosowe */}
              <div className="mt-3 max-w-lg bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur-sm">
                <p className="text-[1rem] leading-relaxed opacity-95 text-left max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {reportText}
                </p>
              </div>
              
              <div className="mt-5 flex items-center justify-center gap-3 sm:justify-start">
                <span className="text-[2.2rem] leading-none">{wb.moodEmoji}</span>
                <div className="text-left">
                  <p className="text-[0.8rem] uppercase tracking-wide opacity-80">Aktualny nastrój</p>
                  <p className="text-[1.15rem] font-medium">{wb.mood}</p>
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
                  <p className="text-[1.05rem] font-medium">{s.value}</p>
                  <p className="text-[0.78rem] opacity-85">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery check-in card (Replaces static mood card) */}
      <div className="flex flex-col rounded-[1.75rem] bg-card p-6 ring-1 ring-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
           <h3 className="text-[1.15rem] text-slate font-display flex items-center gap-2">
             <Camera className="h-5 w-5 text-sage" />
             Galeria zdjęć z dzisiaj
           </h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2 h-full">
          <div className="col-span-2 overflow-hidden rounded-2xl h-32 relative group cursor-pointer">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
              alt={`${resident.first_name} podczas zajęć`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div className="overflow-hidden rounded-2xl h-24 relative group cursor-pointer">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1444312645910-ffa973656eba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
              alt="Spacer"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
          <div className="overflow-hidden rounded-2xl h-24 relative group cursor-pointer bg-slate/5 flex items-center justify-center">
             <span className="text-sage font-medium text-sm">+ Zobacz więcej</span>
          </div>
        </div>
        
        <p className="mt-4 text-[0.85rem] text-slate-soft text-center bg-slate/5 py-2 rounded-xl">
           3 nowe zdjęcia dodane o 14:30
        </p>
      </div>
    </section>
  );
}
