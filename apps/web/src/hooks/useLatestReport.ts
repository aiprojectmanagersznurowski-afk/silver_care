import { useState, useEffect } from 'react';

export interface DailyReportContent {
  text?: string;
  msg?: string;
  steps_total?: number;
  active_minutes?: number;
  sleep_hours?: number;
  [key: string]: unknown;
}

export interface DailyReport {
  id: string;
  status: string;
  created_at: string;
  content: DailyReportContent | null;
}

export function useLatestReport(residentId: string | undefined) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!residentId) return;

    let mounted = true;
    void Promise.resolve().then(() => {
      if (mounted) {
        setLoading(true);
        setError(null);
      }
    });

    fetch(`/api/residents/${residentId}/report/latest`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Wystąpił błąd podczas pobierania raportu');
        }
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setReport(data.report || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(err);
          setError(err.message || 'Wystąpił błąd');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [residentId]);

  return { report, loading, error };
}
