'use client'

import { useEffect, useState } from 'react'
import { CalendarX } from 'lucide-react'

interface AgendaItem {
  id: string
  time: string
  title: string
  resident_id?: string | null
}

interface AgendaTimelineClientProps {
  items: AgendaItem[]
  accentColor?: string
  viewDateStr: string
}

const getCategory = (title: string): "meal" | "activity" | "medication" | "rest" => {
  const t = title.toLowerCase()
  if (t.includes('leki') || t.includes('zabieg') || t.includes('terapia') || t.includes('wizyta') || t.includes('zastrzyk')) return 'medication'
  if (t.includes('śniadanie') || t.includes('obiad') || t.includes('kolacja') || t.includes('posiłek') || t.includes('podwieczorek')) return 'meal'
  if (t.includes('sen') || t.includes('odpoczynek') || t.includes('drzemka')) return 'rest'
  return 'activity' // default
}

const getIcon = (category: string) => {
  switch (category) {
    case 'meal': return '🍽️'
    case 'medication': return '💊'
    case 'rest': return '💤'
    case 'activity': return '🌿'
    default: return '📅'
  }
}

const categoryColors = {
  meal: "#FF9500",
  activity: "#30D158",
  medication: "#AF52DE",
  rest: "#5AC8FA",
}

export function AgendaTimelineClient({ items, accentColor = "#007AFF", viewDateStr }: AgendaTimelineClientProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    const t = setTimeout(() => setLoaded(true), 250)
    return () => clearTimeout(t)
  }, [items, viewDateStr])

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const isToday = viewDateStr === todayStr
  const isFutureDay = viewDateStr > todayStr
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const isPast = (time: string) => {
    if (isFutureDay) return false
    if (!isToday) return true
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m < currentMinutes
  }

  if (!loaded) {
    return (
      <div className="max-w-2xl mx-auto space-y-3 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl h-20 animate-pulse bg-muted" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-20 flex flex-col items-center text-center">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
          style={{ background: "#F2F2F7" }}
        >
          <CalendarX className="h-10 w-10 text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-[20px] font-700 mb-2" style={{ color: "#1C1C1E" }}>
          Brak wydarzeń
        </h2>
        <p className="text-[15px]" style={{ color: "#8E8E93" }}>
          Brak zaplanowanych wydarzeń na ten dzień
        </p>
      </div>
    )
  }

  const doneCount = items.filter(e => isPast(e.time)).length

  return (
    <div
      className="max-w-2xl mx-auto pt-6 pb-10"
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-700 uppercase tracking-widest" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
            Agenda dnia
          </p>
          <p className="text-[17px] font-700" style={{ color: "#1C1C1E" }}>
            {new Date(viewDateStr).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[12px] font-600"
          style={{ background: `${accentColor}1A`, color: accentColor }}
        >
          {doneCount}/{items.length} ukończono
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[52px] top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, #D1D1D6 10%, #D1D1D6 90%, transparent)" }}
        />

        <div className="space-y-1">
          {items.map((event, i) => {
            const past = isPast(event.time)
            const cat = getCategory(event.title)
            const catColor = categoryColors[cat]
            const icon = getIcon(cat)

            return (
              <div
                key={event.id}
                className="flex items-start gap-0"
                style={{
                  opacity: loaded ? 1 : 0,
                  transform: loaded ? "none" : "translateY(8px)",
                  transition: `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s`,
                }}
              >
                {/* Time + dot */}
                <div className="flex flex-col items-end w-12 flex-shrink-0 pt-3.5">
                  <span
                    className="text-[11px] font-600 tabular-nums"
                    style={{ color: past ? "#8E8E93" : "#1C1C1E" }}
                  >
                    {event.time.substring(0, 5)}
                  </span>
                </div>

                {/* Dot connector */}
                <div className="flex-shrink-0 flex flex-col items-center px-3 pt-3.5 z-10">
                  <div
                    className="w-3 h-3 rounded-full border-2 transition-all duration-300"
                    style={{
                      borderColor: past ? catColor : "#D1D1D6",
                      background: past ? catColor : "#fff",
                      boxShadow: past ? `0 0 0 3px ${catColor}22` : "none",
                    }}
                  />
                </div>

                {/* Event card */}
                <div
                  className="flex-1 mb-2 rounded-2xl overflow-hidden transition-all duration-200"
                  style={{
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                    opacity: past ? 1 : 0.72,
                  }}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${catColor}18` }}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-[14px] font-700"
                          style={{
                            color: "#1C1C1E",
                            textDecoration: "none",
                          }}
                        >
                          {event.title}
                        </p>
                        {past && (
                          <span className="text-[10px]" style={{ color: catColor }}>✓</span>
                        )}
                        {event.resident_id && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded ml-auto">
                            Indywidualne
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
