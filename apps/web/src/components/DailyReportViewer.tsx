'use client';

import React from 'react';
import { useLatestReport } from '@/hooks/useLatestReport';

interface DailyReportViewerProps {
  residentId: string;
}

export function DailyReportViewer({ residentId }: DailyReportViewerProps) {
  const { report, loading, error } = useLatestReport(residentId);

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 animate-pulse p-4 border rounded-md">
        <div className="h-6 bg-muted rounded w-1/3"></div>
        <div className="h-4 bg-muted rounded w-full"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
        <p className="font-semibold">Błąd ładowania raportu</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-muted-foreground bg-muted rounded-md border border-dashed border-border">
        <p>Brak raportu - pojawi się wkrótce.</p>
        <p className="text-sm mt-2">Pracujemy nad przygotowaniem najnowszego podsumowania dnia.</p>
      </div>
    );
  }

  const reportDate = new Date(report.created_at).toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="p-4 border rounded-md bg-card">
      <div className="border-b pb-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Raport dnia</h3>
        <p className="text-sm text-muted-foreground capitalize">{reportDate}</p>
      </div>
      
      <div className="text-foreground space-y-4">
        <p>{report.content?.text || report.content?.msg || 'Brak tekstu w raporcie.'}</p>
        
        {/* Renderowanie behawioralnych statystyk (jeśli obecne) */}
        {report.content?.steps_total !== undefined && (
          <div className="flex justify-between py-2 border-t text-sm">
            <span>Kroki:</span>
            <span className="font-semibold">{report.content.steps_total}</span>
          </div>
        )}
        {report.content?.active_minutes !== undefined && (
          <div className="flex justify-between py-2 border-t text-sm">
            <span>Czas aktywności:</span>
            <span className="font-semibold">{report.content.active_minutes} min</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
        Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki
      </div>
    </div>
  );
}
