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
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
        <p className="font-semibold">Błąd ładowania raportu</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-md border border-dashed border-gray-300">
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
    <div className="p-4 border rounded-md bg-white shadow-sm">
      <div className="border-b pb-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Raport dnia</h3>
        <p className="text-sm text-gray-500 capitalize">{reportDate}</p>
      </div>
      
      <div className="text-gray-700 space-y-4">
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

      <div className="mt-6 pt-4 border-t text-xs text-gray-400 text-center">
        Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki
      </div>
    </div>
  );
}
