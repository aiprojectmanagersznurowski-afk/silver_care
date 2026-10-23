'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar as CalendarIcon, CheckCircle2, Pencil, Trash2, Users } from 'lucide-react'
import {
  AgendaItem,
  ResidentSummary,
  TIME_SLOTS,
  ITEM_TYPES,
  getItemSlot,
  isCurrentSlot,
} from './agenda-types'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface AgendaTimelineSectionProps {
  items: AgendaItem[]
  residents: ResidentSummary[]
  loading: boolean
  viewDate: string
  onViewDateChange: (date: string) => void
  onOpenEdit: (item: AgendaItem) => void
  onOpenDelete: (itemId: string) => void
}

export function AgendaTimelineSection({
  items,
  residents,
  loading,
  viewDate,
  onViewDateChange,
  onOpenEdit,
  onOpenDelete,
}: AgendaTimelineSectionProps) {
  const isToday = viewDate === new Date().toISOString().slice(0, 10)

  return (
    <Card className="rounded-xl border-none ring-1 ring-border bg-card overflow-hidden">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-muted/50">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Harmonogram dnia
          </h3>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {new Date(viewDate).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={viewDate}
            onChange={(e) => onViewDateChange(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-touch"
          />
          <button
            onClick={() => onViewDateChange(new Date().toISOString().slice(0, 10))}
            className="rounded-xl bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-inset ring-border hover:bg-muted/50 transition-colors min-h-touch"
          >
            Dziś
          </button>
        </div>
      </div>

      <CardContent className="p-6 space-y-8">
        {loading ? (
          <div className="py-12 text-center text-sm font-medium text-muted-foreground">
            Ładowanie harmonogramu...
          </div>
        ) : (
          <div className="space-y-6">
            {TIME_SLOTS.map((slot) => {
              const slotItems = items.filter((it) => getItemSlot(it.time) === slot.key)
              const isNow = isCurrentSlot(slot) && isToday
              const IconComp = slot.icon

              return (
                <div
                  key={slot.key}
                  data-slot={slot.key}
                  className={`rounded-xl border p-5 transition-all ${
                    isNow
                      ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                      : 'bg-card border-border hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isNow ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground text-base">{slot.label}</h4>
                          {isNow && (
                            <StatusBadge tone="brand">
                              <CheckCircle2 />
                              Teraz
                            </StatusBadge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{slot.timeRange}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                      Wpisów: {slotItems.length}
                    </span>
                  </div>

                  {slotItems.length === 0 ? (
                    <div className="py-4 text-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-xl border border-dashed border-border">
                      Brak zaplanowanych zadań na tę porę dnia.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {slotItems.map((item) => {
                        const resident = item.resident_id
                          ? residents.find((r) => r.id === item.resident_id)
                          : null

                        return (
                          <div
                            key={item.id}
                            className="group flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-border transition-all"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="flex items-center justify-center rounded-lg bg-muted/50 text-foreground font-bold text-sm px-2.5 py-1.5 shrink-0 mt-0.5">
                                {item.time.slice(0, 5)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-foreground text-sm">{item.title}</h5>
                                  {!item.target_date && (
                                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-sm font-medium text-muted-foreground">
                                      Codziennie
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {ITEM_TYPES.find((t) => t.value === item.type)?.label || item.type}
                                  </span>
                                  <span>·</span>
                                  {resident ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                      <Users className="h-3 w-3" />
                                      {resident.first_name} {resident.last_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">Cała placówka (ogólne)</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => onOpenEdit(item)}
                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors min-h-touch min-w-touch inline-flex items-center justify-center"
                                title="Edytuj wpis"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenDelete(item.id)}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors min-h-touch min-w-touch inline-flex items-center justify-center"
                                title="Usuń wpis"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
