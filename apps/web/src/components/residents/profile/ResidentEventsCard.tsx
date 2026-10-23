'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Clock,
  Calendar,
  FileText,
  Home,
  RefreshCw,
  Bed,
  Plus,
  Minus,
  Flame,
} from 'lucide-react'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  EventType,
} from '@/lib/reporting-constants'
import { ResidentEventItem } from './profile-types'

interface ResidentEventsCardProps {
  events: ResidentEventItem[]
}

const EVENT_TYPE_LUCIDE_ICONS: Partial<Record<EventType, React.ComponentType<{ className?: string }>>> = {
  contract_signed: FileText,
  contract_ended: FileText,
  death: Flame,
  care_level_changed: RefreshCw,
  admission: Home,
  bed_transfer: Bed,
  package_added: Plus,
  package_removed: Minus,
}

export function ResidentEventsCard({ events }: ResidentEventsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Historia i rejestr zdarzeń ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {events.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            Brak zarejestrowanych zdarzeń formalnych w kartotece.
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {events.map((ev) => {
              const type = ev.event_type as EventType
              const label = EVENT_TYPE_LABELS[type] || ev.event_type
              const EventIcon = EVENT_TYPE_LUCIDE_ICONS[type] || EVENT_TYPE_ICONS[type] || Calendar

              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                    {typeof EventIcon === 'string' ? (
                      <span className="text-base leading-none" aria-hidden="true">
                        {EventIcon}
                      </span>
                    ) : (
                      <EventIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground">{label}</span>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {ev.event_date?.substring(0, 10)}
                      </span>
                    </div>
                    {ev.event_reason && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Powód: {ev.event_reason}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
