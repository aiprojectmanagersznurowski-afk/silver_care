import { Sparkles, CheckCircle2, Sun, Footprints, Camera, Activity, Heart } from "lucide-react";
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

function WellbeingMoodIndicator({ mood, moodEmoji }: { mood: string; moodEmoji: string }) {
  return (
    <div className="relative flex h-[140px] w-[140px] shrink-0 flex-col items-center justify-center rounded-xl bg-card/15 p-4 backdrop-blur-sm border border-white/20 shadow-inner">
      <span className="text-[3rem] leading-none select-none">{moodEmoji}</span>
      <span className="mt-2 text-[0.85rem] font-semibold text-primary-foreground tracking-wide text-center">
        {mood}
      </span>
      <span className="text-[0.7rem] opacity-80 text-primary-foreground/90 uppercase tracking-wider">
        Samopoczucie
      </span>
    </div>
  );
}

interface DailySummaryHeroProps {
  resident: {
    id?: string;
    first_name: string;
    last_name: string;
  };
  report?: {
    id?: string;
    created_at?: string;
    content?: {
      text?: string;
      metrics?: {
        steps?: number;
        sleep_hours?: number;
      };
    };
  } | null;
  selectedDateMedia?: string[];
  onOpenGallery?: (index?: number) => void;
  selectedDate?: string | Date;
}

export function DailySummaryHero({ resident, report, selectedDateMedia = [], onOpenGallery, selectedDate }: DailySummaryHeroProps) {
  const reportText = report?.content?.text || 'Brak dzisiejszego raportu od personelu. Czekamy na pierwsze wpisy.';
  const wb = deriveWellbeing(report?.content?.text);

  const targetDate = selectedDate
    ? new Date(selectedDate)
    : (report?.created_at ? new Date(report.created_at) : new Date());

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = yesterday.toISOString().slice(0, 10);

  const dateLabel = targetDateStr === todayDateStr
    ? `Dzisiaj · ${format(targetDate, 'EEEE, d MMMM', { locale: pl })}`
    : targetDateStr === yesterdayDateStr
    ? `Wczoraj · ${format(targetDate, 'EEEE, d MMMM', { locale: pl })}`
    : format(targetDate, 'EEEE, d MMMM yyyy', { locale: pl });

  const quickStats = [
    { icon: CheckCircle2, label: "Sen", value: wb.sleep },
    { icon: report?.content?.metrics?.steps ? Footprints : Activity, label: "Kroki dzisiaj", value: report?.content?.metrics?.steps ? `${report.content.metrics.steps}` : "Brak opaski" },
    { icon: Sun, label: "Apetyt", value: wb.appetite },
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* Well-being card */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-card/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-card/5" />
        <div className="relative">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <p className="text-[0.95rem] opacity-90 capitalize">{dateLabel}</p>
            </div>
            {report?.created_at && (
              <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-card/20">
                Opublikowano {format(new Date(report.created_at), 'HH:mm')}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
            <WellbeingMoodIndicator mood={wb.mood} moodEmoji={wb.moodEmoji} />
            <div className="flex-1 min-w-0">
              <h2 className="text-[1.4rem] leading-tight break-words text-primary-foreground sm:text-[1.6rem]">Podsumowanie Dnia</h2>
              <div className="mt-3 bg-card/10 rounded-xl p-4 border border-white/20 backdrop-blur-sm">
                <p className="text-[1rem] leading-relaxed opacity-95 text-left max-h-48 overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap">
                  {reportText}
                </p>
                <p className="mt-3 border-t border-white/15 pt-2 text-[0.72rem] opacity-80 italic text-left">
                  Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            {quickStats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-xl bg-card/15 px-4 py-3 backdrop-blur-sm"
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

      {/* Gallery check-in card */}
      <div className="flex flex-col rounded-[1.75rem] bg-card p-6 border border-border justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[1.15rem] text-foreground font-display flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Galeria zdjęć z dzisiaj
            </h3>
            {selectedDateMedia.length > 0 && onOpenGallery && (
              <button 
                onClick={() => onOpenGallery(0)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Otwórz pełną galerię
              </button>
            )}
          </div>
          
          {selectedDateMedia.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <div 
                onClick={() => onOpenGallery?.(0)}
                className="col-span-2 overflow-hidden rounded-xl h-32 relative group cursor-pointer shadow-inner bg-muted/50"
              >
                <img
                  src={selectedDateMedia[0]}
                  alt={`Zdjęcie z aktywności`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              {selectedDateMedia.length > 1 ? (
                <div 
                  onClick={() => onOpenGallery?.(1)}
                  className="overflow-hidden rounded-xl h-24 relative group cursor-pointer shadow-inner bg-muted/50"
                >
                  <img
                    src={selectedDateMedia[1]}
                    alt="Zdjęcie z aktywności"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div 
                  onClick={() => onOpenGallery?.(0)}
                  className="overflow-hidden rounded-xl h-24 relative group cursor-pointer bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <span className="text-primary font-medium text-xs">Zobacz więcej</span>
                </div>
              )}
              <div 
                onClick={() => onOpenGallery?.(selectedDateMedia.length > 2 ? 2 : 0)}
                className="overflow-hidden rounded-xl h-24 relative group cursor-pointer bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <span className="text-primary font-medium text-sm">
                  {selectedDateMedia.length > 2 ? `+ ${selectedDateMedia.length - 2} więcej` : "Zobacz galerię"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-muted/50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-2">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Brak nowych zdjęć z dzisiaj</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
                Personel placówki dodaje zdjęcia podczas warsztatów, spacerów i wydarzeń.
              </p>
              {onOpenGallery && (
                <button
                  onClick={() => onOpenGallery(0)}
                  className="mt-4 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary border border-border hover:bg-accent/60 transition-colors"
                >
                  Przeglądaj wcześniejsze zdjęcia →
                </button>
              )}
            </div>
          )}
        </div>

        {selectedDateMedia.length > 0 && (
          <p className="mt-4 text-[0.85rem] text-muted-foreground text-center bg-muted/50 py-2 rounded-xl">
            {selectedDateMedia.length === 1 ? "1 zdjęcie dodane dzisiaj" : `${selectedDateMedia.length} zdjęć dodanych dzisiaj`}
          </p>
        )}
      </div>
    </section>
  );
}
