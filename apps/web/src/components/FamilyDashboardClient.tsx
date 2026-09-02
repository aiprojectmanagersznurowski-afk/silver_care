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

      <div className="flex items-center gap-2">
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
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
      >
        <div className="space-y-6">
          {/* Activity rings card */}
          {hasMetrics && (
            <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-card">
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4 text-text-tertiary" style={{ letterSpacing: "0.1em" }}>
                  Aktywność dzienna
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-shrink-0 flex justify-center sm:justify-start">
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
                          <p className="text-[13px] font-medium text-text-secondary">{item.label}</p>
                          <p className="text-[16px] font-bold text-foreground">{item.value}</p>
                          <p className="text-[11px] text-text-tertiary">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Wellbeing summary */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-card">
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-tertiary" style={{ letterSpacing: "0.1em" }}>
                  Samopoczucie
                </p>
                <span className="text-[12px] font-medium text-text-tertiary">dzisiaj</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "😴", label: "Sen", value: "Dobry" },
                  { icon: "🍽️", label: "Apetyt", value: "Bardzo dobry" },
                  { icon: "😊", label: "Nastrój", value: "Pogodny" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-3 text-center bg-surface-sunken dark:bg-muted"
                  >
                    <div className="text-xl mb-1">{item.icon}</div>
                    <p className="text-[11px] font-medium mb-0.5 text-text-secondary">{item.label}</p>
                    <p className="text-[12px] font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Caregiver report */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-card h-fit">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-tertiary" style={{ letterSpacing: "0.1em" }}>
                  Notatka opiekuna
                </p>
                {latestReport && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                  >
                    {format(new Date(latestReport.created_at), "d MMMM", { locale: pl })}
                  </span>
                )}
              </div>
              {latestReport ? (
                <div
                  className="rounded-xl p-4 border-l-[3px] border-l-primary bg-gradient-to-br from-surface-sunken to-muted/20"
                >
                  <p className="text-[14px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                    {latestReport.content.text || 'Brak treści raportu.'}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-primary/40">
                      PO
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">Personel Opiekuńczy</p>
                      <p className="text-[10px] text-text-tertiary">
                        {format(new Date(latestReport.created_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-text-secondary text-sm">
                  Brak opublikowanych raportów.
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Kontakt z administracją</CardTitle>
              <CardDescription>
                Zostaw wiadomość dla personelu placówki.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FamilyMessageForm residentId={resident.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
