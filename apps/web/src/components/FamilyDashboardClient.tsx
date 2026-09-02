'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { FamilyMessageForm } from '@/components/FamilyMessageForm'
import { OnboardingModal } from '@/components/OnboardingModal'
import { ActivityRings } from '@/components/ActivityRings'
import { useEffect } from 'react'

interface Resident {
  id: string
  first_name: string
  last_name: string
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
}

/**
 * Widok kliencki dashboardu rodziny.
 */
function deriveWellbeing(text?: string) {
  if (!text) return { sleep: "Brak danych", appetite: "Brak danych", mood: "Brak danych" };
  const lower = text.toLowerCase();

  let sleep = "W normie";
  let appetite = "W normie";
  let mood = "Neutralny";

  // Analiza Snu
  if (lower.includes("sen") || lower.includes("spa") || lower.includes("noc")) {
    if (lower.match(/(dobrze|spokojnie|przespa|długo)/)) sleep = "Dobry";
    else if (lower.match(/(wybudza|zły|niespokojny|nie spa|przerwa)/)) sleep = "Przerywany";
  }

  // Analiza Apetytu
  if (lower.includes("apetyt") || lower.includes("jad") || lower.includes("posił") || lower.includes("obiad")) {
    if (lower.match(/(dopisywał|chętnie|cały|smakiem|bardzo dobry|dobry)/)) appetite = "Bardzo dobry";
    else if (lower.match(/(brak|nie chcia|mało|odmówi|słaby)/)) appetite = "Słaby";
  }

  // Analiza Nastroju
  if (lower.match(/(nastr|humor|samopoczucie|czuje)/)) {
    if (lower.match(/(dobrym|świetnym|pogodny|uśmiechnię|wesoł|dobrze)/)) mood = "Pogodny";
    else if (lower.match(/(smutn|apatyczn|zdenerwowan|zły|niespokojn|pobudzon|napięt|płacz)/)) mood = "Obniżony";
  } else {
    // Jeżeli nie ma słowa "nastrój", ale jest "pogodny" lub inne silne pozytywy w całym tekście:
    if (lower.match(/(pogodny|uśmiechnięt|wesoł|zadowolon)/)) mood = "Pogodny";
    if (lower.match(/(smutn|apatyczn|zdenerwowan|pobudzon)/)) mood = "Obniżony";
  }

  return { sleep, appetite, mood };
}

export function FamilyDashboardClient({ resident, reports }: FamilyDashboardClientProps) {
  const [loaded, setLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setMounted(false)
    const t1 = setTimeout(() => setLoaded(true), 300)
    const t2 = setTimeout(() => setMounted(true), 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [resident?.id])

  if (!resident) return null

  const latestReport = reports[0] // We know it's ordered by created_at DESC from the server

  // Goals for polar rings
  const stepsGoal = 6000
  const activityGoal = 60 // minutes
  const sleepGoal = 8 // hours

  const metrics = latestReport?.content?.metrics || {}
  const hasMetrics = metrics.steps !== undefined || metrics.sleep_hours !== undefined

  const stepsProgress = (metrics.steps || 0) / stepsGoal
  // if we have steps, we can roughly estimate activity minutes or assume it's missing (Polar usually gives both)
  // for now let's just make it up based on steps if not provided, or 0
  const activityProgress = (metrics.steps ? Math.floor(metrics.steps / 100) : 0) / activityGoal
  const sleepProgress = (metrics.sleep_hours || 0) / sleepGoal

  const ringLegend = [
    { label: "Kroki", value: metrics.steps || 0, sub: `cel: ${stepsGoal}`, color: "#FF6B47" },
    { label: "Aktywność", value: `${metrics.steps ? Math.floor(metrics.steps / 100) : 0} min`, sub: `cel: ${activityGoal} min`, color: "#30D158" },
    { label: "Sen", value: `${metrics.sleep_hours || 0} godz.`, sub: `cel: ${sleepGoal} godz.`, color: "#AF52DE" },
  ]

  return (
    <div className="space-y-6">
      <OnboardingModal />

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {resident.first_name} {resident.last_name}
        </h2>
        <p className="text-text-secondary">Najnowsze informacje z placówki</p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
          style={{ background: "rgba(52,199,89,0.12)", color: "#248A3D" }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "#34C759", boxShadow: "0 0 0 2px rgba(52,199,89,0.3)" }}
          />
          Aktywny dzisiaj
        </span>
        <span className="text-[12px]" style={{ color: "#8E8E93" }}>
          Ostatnia aktywność: 14:32
        </span>
      </div>

      <div
        className="space-y-4"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
      >
        {/* Activity rings card */}
        {hasMetrics && (
          <div className="rounded-2xl" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)" }}>
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
                Aktywność dzienna
              </p>
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <ActivityRings
                    stepsProgress={stepsProgress}
                    activityProgress={activityProgress}
                    sleepProgress={sleepProgress}
                  />
                </div>
                <div className="flex flex-col gap-4 flex-1">
                  {ringLegend.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: item.color }}
                      />
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: "#8E8E93" }}>{item.label}</p>
                        <p className="text-[16px] font-bold" style={{ color: "#1C1C1E" }}>{item.value}</p>
                        <p className="text-[11px]" style={{ color: "#C7C7CC" }}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wellbeing summary */}
        <div className="rounded-2xl" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)" }}>
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
                Samopoczucie
              </p>
              <span className="text-[12px] font-medium" style={{ color: "#C7C7CC" }}>dzisiaj</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "😴", label: "Sen", value: deriveWellbeing(latestReport?.content?.text).sleep },
                { icon: "🍽️", label: "Apetyt", value: deriveWellbeing(latestReport?.content?.text).appetite },
                { icon: "😊", label: "Nastrój", value: deriveWellbeing(latestReport?.content?.text).mood },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "#F2F2F7" }}
                >
                  <div className="text-xl mb-1">{item.icon}</div>
                  <p className="text-[11px] font-medium mb-0.5" style={{ color: "#8E8E93" }}>{item.label}</p>
                  <p className="text-[12px] font-bold" style={{ color: "#1C1C1E" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Caregiver report */}
        <div className="rounded-2xl" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)" }}>
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
                Notatka opiekuna
              </p>
              {latestReport && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,107,71,0.1)", color: "#FF6B47" }}
                >
                  Nowa
                </span>
              )}
            </div>
            {latestReport ? (
              <div
                className="rounded-xl p-4"
                style={{ background: "linear-gradient(135deg, #F9F9FB 0%, #F2F2F7 100%)", borderLeft: `3px solid #FF6B47` }}
              >
                <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap" style={{ color: "#3A3A3C" }}>
                  {latestReport.content.text || 'Brak treści raportu.'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#8E8E93" }}>
                    PO
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: "#3A3A3C" }}>Personel Opiekuńczy</p>
                    <p className="text-[10px]" style={{ color: "#8E8E93" }}>
                      Opiekun • dzisiaj, {format(new Date(latestReport.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm" style={{ color: "#8E8E93" }}>
                Brak opublikowanych raportów.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
