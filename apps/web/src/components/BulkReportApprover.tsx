'use client'

import React, { useState, useTransition } from 'react'
import { CheckSquare, Square, Send, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bulkPublishReportsAction } from '@/actions/bulk-reports'
import { useRouter } from 'next/navigation'

interface DraftReport {
  id: string
  resident_id: string
  created_at: string
  status: string
  content?: { text?: string; [key: string]: unknown }
  residents?: {
    first_name?: string
    last_name?: string
  } | null
}

interface BulkReportApproverProps {
  draftReports: DraftReport[]
}

export function BulkReportApprover({ draftReports }: BulkReportApproverProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const router = useRouter()

  if (!draftReports || draftReports.length === 0) {
    return null
  }

  // Ograniczenie do max 10 raportów w jednej partii wg AC1
  const selectableDrafts = draftReports.slice(0, 10)
  const isAllSelected =
    selectableDrafts.length > 0 &&
    selectableDrafts.every((r) => selectedIds.includes(r.id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectableDrafts.map((r) => r.id))
    }
  }

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
    } else {
      if (selectedIds.length >= 10) {
        setErrorMessage('Maksymalnie 10 raportów można wybrać do jednoczesnej publikacji.')
        return
      }
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleBulkPublish = () => {
    if (selectedIds.length === 0) return
    setErrorMessage(null)
    setSuccessCount(null)

    startTransition(async () => {
      try {
        const res = await bulkPublishReportsAction(selectedIds)
        if (!res.success) {
          setErrorMessage(res.error || 'Wystąpił błąd podczas masowej publikacji.')
        } else {
          setSuccessCount(res.publishedCount || selectedIds.length)
          setSelectedIds([])
          router.refresh()
          setTimeout(() => setSuccessCount(null), 4000)
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Błąd połączenia z serwerem.')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-sage/20 bg-sage/5 p-4 sm:p-5 mb-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={isPending}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate hover:text-sage min-h-[48px] px-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage/40 transition-colors"
            aria-label={isAllSelected ? 'Odznacz wszystkie raporty' : 'Zaznacz wszystkie zweryfikowane raporty'}
          >
            {isAllSelected ? (
              <CheckSquare className="h-5 w-5 text-sage stroke-[2.5]" />
            ) : (
              <Square className="h-5 w-5 text-slate-soft stroke-[2]" />
            )}
            <span>Zaznacz wszystkie zweryfikowane (max 10)</span>
          </button>
          <span className="text-xs text-slate-soft">
            Wybrano: <strong className="text-slate">{selectedIds.length}</strong> / {selectableDrafts.length}
          </span>
        </div>

        <Button
          type="button"
          onClick={handleBulkPublish}
          disabled={selectedIds.length === 0 || isPending}
          className="bg-sage hover:bg-sage-dark text-white font-semibold min-h-[48px] px-5 rounded-xl shadow-xs inline-flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publikowanie...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Zatwierdź i publikuj zaznaczone ({selectedIds.length})
            </>
          )}
        </Button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successCount !== null && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Pomyślnie opublikowano <strong>{successCount}</strong> raportów dla rodzin pensjonariuszy!
          </span>
        </div>
      )}

      {/* Szybka lista wybranych ze wskaźnikiem */}
      <div className="flex flex-wrap gap-2 pt-1">
        {selectableDrafts.map((report) => {
          const isSelected = selectedIds.includes(report.id)
          const name = report.residents
            ? `${report.residents.first_name || ''} ${report.residents.last_name || ''}`.trim()
            : 'Podopieczny'

          return (
            <button
              key={report.id}
              type="button"
              onClick={() => toggleSelectOne(report.id)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                isSelected
                  ? 'bg-sage text-white border-sage shadow-xs'
                  : 'bg-white text-slate border-slate/20 hover:border-slate/40'
              }`}
            >
              {isSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5 opacity-60" />
              )}
              <span>{name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
