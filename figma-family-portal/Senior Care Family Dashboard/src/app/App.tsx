import { useState } from "react";
import { Header } from "./components/Header";
import { DailySummaryHero } from "./components/DailySummaryHero";
import { ServiceActivityFeed } from "./components/ServiceActivityFeed";
import { HealthRingInsight } from "./components/HealthRingInsight";
import { CommunicationWidget } from "./components/CommunicationWidget";
import { TimeRangeFilter, type TimeRange } from "./components/TimeRangeFilter";

export default function App() {
  const [range, setRange] = useState<TimeRange>("Dzień");

  return (
    <div className="min-h-screen w-full bg-cream text-slate">
      <Header />

      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pb-28 sm:pt-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[1.75rem] text-slate sm:text-[2rem]">Dzień dobry, Ewo</h1>
            <p className="mt-1 text-[1rem] text-slate-soft sm:text-[1.05rem]">
              Oto jak dziś czuje się Twoja mama, Katarzyna.
            </p>
          </div>
          <TimeRangeFilter value={range} onChange={setRange} />
        </div>

        <div className="space-y-5">
          <DailySummaryHero />

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <ServiceActivityFeed />
            <HealthRingInsight />
          </div>
        </div>
      </main>

      <CommunicationWidget />
    </div>
  );
}
