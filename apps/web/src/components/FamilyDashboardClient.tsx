'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

import { DailySummaryHero } from './DailySummaryHero'
import { ServiceActivityFeed } from './ServiceActivityFeed'
import { HealthRingInsight } from './HealthRingInsight'
import { CommunicationWidget } from './CommunicationWidget'
import { TimeRangeFilter, type TimeRange } from './TimeRangeFilter'

interface Resident {
  id: string
  first_name: string
  last_name: string
  accentColor?: string
}

interface Report {
  id: string
  resident_id: string
  created_at: string
  content: {
    text?: string
    metrics?: {
      steps?: number
      sleep_hours?: number
    }
  }
}

interface FamilyDashboardClientProps {
  resident: Resident
  reports: Report[]
  todaysMedia?: string[]
}

type TabType = 'DASHBOARD' | 'AGENDA' | 'GALERIA';

export function FamilyDashboardClient({ resident, reports, todaysMedia = [] }: FamilyDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [range, setRange] = useState<TimeRange>("Dzień");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const latestReport = reports[0];

  return (
    <div className="min-h-screen w-full bg-cream text-slate font-sans relative">
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pb-28 sm:pt-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[1.75rem] text-slate sm:text-[2rem] font-display">
              Dzień dobry, Ewo
            </h1>
            <p className="mt-1 text-[1rem] text-slate-soft sm:text-[1.05rem]">
              Oto najnowsze informacje o tym, co u {resident.first_name}.
            </p>
          </div>
          <TimeRangeFilter value={range} onChange={setRange} />
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6 bg-slate/5 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'DASHBOARD' ? 'bg-white shadow-sm text-sage' : 'text-slate-soft hover:text-slate'}`}
          >
            Podsumowanie
          </button>
          <button 
            onClick={() => setActiveTab('AGENDA')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'AGENDA' ? 'bg-white shadow-sm text-sage' : 'text-slate-soft hover:text-slate'}`}
          >
            Agenda i Menu
          </button>
          <button 
            onClick={() => setActiveTab('GALERIA')}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'GALERIA' ? 'bg-white shadow-sm text-sage' : 'text-slate-soft hover:text-slate'}`}
          >
            Galeria Dnia
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === 'DASHBOARD' && (
            <>
              <DailySummaryHero resident={resident} report={latestReport} />

              <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                {/* Ograniczony widok agendy na stronie głównej */}
                <ServiceActivityFeed compact />
                
                {latestReport?.content?.metrics && (
                  <HealthRingInsight metrics={latestReport.content.metrics} />
                )}
              </div>
            </>
          )}

          {activeTab === 'AGENDA' && (
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
               <h2 className="text-xl font-display mb-6 text-slate">Pełny harmonogram i jadłospis</h2>
               <ServiceActivityFeed showMenu={true} />
             </div>
          )}

          {activeTab === 'GALERIA' && (
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
               <h2 className="text-xl font-display mb-2 text-slate">Galeria i Wspomnienia</h2>
               <p className="text-slate-soft mb-6">Wybierz dzień, aby zobaczyć zdjęcia z zajęć i przeczytać pełny raport dzienny.</p>
               
               <div className="grid gap-6">
                 {/* Przykład dni z galerii */}
                 {reports.map((report) => (
                    <div key={report.id} className="border border-border/50 rounded-2xl p-5 bg-cream-deep/50">
                       <h3 className="font-medium text-lg mb-3">
                         {format(new Date(report.created_at), 'EEEE, d MMMM', { locale: pl })}
                       </h3>
                       {/* Galeria Grid */}
                       <div className="flex w-max space-x-4 p-4">
                        {todaysMedia.length > 0 ? (
                          todaysMedia.map((url, i) => (
                            <div key={i} className="group relative h-[250px] w-[350px] overflow-hidden rounded-3xl shrink-0 cursor-pointer shadow-sm">
                              <img
                                src={url}
                                alt="Zdjęcie z dzisiaj"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            </div>
                          ))
                        ) : (
                          <div className="flex h-[250px] w-full items-center justify-center rounded-3xl border border-dashed border-border text-slate-soft p-8">
                            Brak zdjęć z dzisiejszego dnia
                          </div>
                        )}
                      </div>
                       {/* Raport */}
                       <div className="bg-white p-4 rounded-xl border border-border/30">
                         <p className="text-sm font-medium text-sage mb-1">Notatka pielęgniarska</p>
                         <p className="text-slate text-[0.95rem] leading-relaxed">
                            {report.content.text || "Brak notatki dla tego dnia."}
                         </p>
                       </div>
                    </div>
                 ))}
               </div>
             </div>
          )}
        </div>
      </main>

      <CommunicationWidget residentId={resident.id} />
    </div>
  )
}
