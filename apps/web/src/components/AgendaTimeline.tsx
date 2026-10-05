'use client';

import React from 'react';
import { useAgenda } from '@/hooks/useAgenda';
import { AgendaItem } from '@/lib/agenda';

interface AgendaTimelineProps {
  residentId: string;
}

export function AgendaTimeline({ residentId }: AgendaTimelineProps) {
  const { agenda, loading, error } = useAgenda(residentId);

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 animate-pulse p-4">
        <div className="h-4 bg-muted rounded w-1/4"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
        <p className="font-semibold">Błąd ładowania agendy</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (agenda.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-muted rounded-md border border-dashed border-border">
        <p>Brak zaplanowanych wydarzeń na dziś.</p>
        <p className="text-sm mt-2">Gdy tylko pojawi się plan dnia, zobaczysz go tutaj.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Plan Dnia</h3>
      <div className="relative border-l border-border ml-3 space-y-6">
        {agenda.map((item: AgendaItem) => (
          <div key={item.id} className="mb-8 ml-6 relative">
            <span className="absolute -left-[35px] top-1 flex items-center justify-center w-6 h-6 bg-muted rounded-full ring-4 ring-card">
              <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{item.time}</span>
              <h4 className="text-md font-medium text-foreground">{item.title}</h4>
              <span className="text-xs text-muted-foreground">{item.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
