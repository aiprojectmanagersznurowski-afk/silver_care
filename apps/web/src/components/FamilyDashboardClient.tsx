'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { Sparkles, Camera, ChevronLeft, ChevronRight } from 'lucide-react'

import { DailySummaryHero } from './DailySummaryHero'
import { ServiceActivityFeed } from './ServiceActivityFeed'
import { HealthRingInsight } from './HealthRingInsight'
import { CommunicationWidget } from './CommunicationWidget'
import { PhotoGalleryModal } from './PhotoGalleryModal'
import { getAdjacentDateString } from '@/lib/date-navigation'

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
  selectedDateMedia?: string[]
  agenda?: Array<{ id: string; title: string; time: string; type: string; resident_id: string | null }>
  selectedDate: string
}

type TabType = 'DASHBOARD' | 'AGENDA' | 'GALERIA';

export function FamilyDashboardClient({ resident, reports, selectedDateMedia = [], agenda = [], selectedDate }: FamilyDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [mounted, setMounted] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [galleryModalIndex, setGalleryModalIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    const url = new URL(window.location.href);
    url.searchParams.set('date', newDate);
    router.push(url.pathname + url.search);
  };

  const openGalleryModal = (index: number = 0) => {
    setGalleryModalIndex(index);
    setGalleryModalOpen(true);
  };

  const activeReport = reports.find(r => r.created_at.startsWith(selectedDate)) || null;

  return (
    <div className="min-h-screen w-full bg-cream text-slate font-sans relative">
      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 sm:pb-28 sm:pt-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[1.75rem] text-slate sm:text-[2rem] font-display">
              Dzień dobry
            </h1>
            <p className="mt-1 text-[1rem] text-slate-soft sm:text-[1.05rem]">
              Oto najnowsze informacje o podopiecznym: {resident.first_name} {resident.last_name}.
            </p>
          </div>

          {/* Date navigation bar */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-border shadow-sm">
            <button 
              type="button"
              onClick={() => handleDateChange(getAdjacentDateString(selectedDate, -1))}
              aria-label="Poprzedni dzień"
              className="p-1.5 rounded-lg hover:bg-slate/5 text-slate transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input 
              type="date" 
              className="rounded-lg border-0 bg-transparent text-sm font-medium text-slate focus:outline-none focus:ring-0 cursor-pointer"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            />
            <button 
              type="button"
              onClick={() => handleDateChange(getAdjacentDateString(selectedDate, 1))}
              aria-label="Następny dzień"
              className="p-1.5 rounded-lg hover:bg-slate/5 text-slate transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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
              <DailySummaryHero 
                resident={resident} 
                report={activeReport} 
                selectedDateMedia={selectedDateMedia}
                onOpenGallery={openGalleryModal}
              />

              <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] items-start">
                {/* Agenda i Zdarzenia */}
                <div className="flex-1 min-w-0">
                  <ServiceActivityFeed compact agenda={agenda} />
                </div>
                
                {activeReport?.content?.metrics && (
                  <div className="sticky top-24">
                    <HealthRingInsight metrics={activeReport.content.metrics} />
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'AGENDA' && (
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
               <h2 className="text-xl font-display mb-6 text-slate">Pełny harmonogram i jadłospis</h2>
               <ServiceActivityFeed showMenu={true} agenda={agenda} />
             </div>
          )}

          {activeTab === 'GALERIA' && (
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
               <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                   <h2 className="text-xl font-display mb-2 text-slate">Galeria i Wspomnienia</h2>
                   <p className="text-slate-soft">Wybierz dzień, aby zobaczyć zdjęcia z zajęć i przeczytać pełny raport dzienny.</p>
                 </div>
               </div>
               
                {/* Displaying media for the selected date */}
                <div className="border border-border/50 rounded-2xl p-5 bg-cream-deep/50 mt-6">
                  <h3 className="font-medium text-lg mb-3">
                    {format(new Date(selectedDate), 'EEEE, d MMMM', { locale: pl })}
                  </h3>
                  
                  {/* Gallery Grid */}
                  <div className="flex w-full space-x-4 py-4 overflow-x-auto custom-scrollbar">
                    {selectedDateMedia.length > 0 ? (
                      selectedDateMedia.map((url, i) => (
                        <div 
                          key={i} 
                          onClick={() => openGalleryModal(i)}
                          className="group relative h-[250px] w-[350px] overflow-hidden rounded-3xl shrink-0 cursor-pointer shadow-sm"
                        >
                          <img
                            src={url}
                            alt="Zdjęcie z tego dnia"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        </div>
                      ))
                    ) : (
                      <div className="flex h-[250px] w-full items-center justify-center rounded-3xl border border-dashed border-border/70 bg-white/50 text-slate-soft p-8 text-center flex-col gap-2">
                        <Camera className="h-8 w-8 opacity-20" />
                        <p>Brak zdjęć w wybranym dniu</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Raport */}
                  <div className="bg-white p-5 rounded-xl border border-border/30 mt-4 shadow-sm">
                    <p className="text-sm font-semibold text-sage mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Notatka
                    </p>
                    <p className="text-slate leading-relaxed overflow-y-auto max-h-48 pr-2 custom-scrollbar">
                      {reports.find(r => r.created_at.startsWith(selectedDate))?.content?.text || "Brak treści raportu z tego dnia."}
                    </p>
                  </div>
                </div>
             </div>
          )}
        </div>
      </main>

      <PhotoGalleryModal
        images={selectedDateMedia}
        initialIndex={galleryModalIndex}
        isOpen={galleryModalOpen}
        onClose={() => setGalleryModalOpen(false)}
      />

      <CommunicationWidget residentId={resident.id} />
    </div>
  )
}
