'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Bed,
} from 'lucide-react'
import {
  FacilityAllocationMetrics,
  RelocationSuggestion,
} from '@/lib/bed-allocation-optimizer'
import {
  analyzeBedAllocationAction,
  executeBedRelocationAction,
} from '@/actions/bed-allocation'

interface BedAllocationOptimizerDialogProps {
  onAllocationChanged?: () => void
}

export function BedAllocationOptimizerDialog({
  onAllocationChanged,
}: BedAllocationOptimizerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [metrics, setMetrics] = useState<FacilityAllocationMetrics | null>(null)
  const [suggestions, setSuggestions] = useState<RelocationSuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      loadAnalysis()
    } else {
      setError(null)
      setSuccess(null)
    }
  }

  const loadAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const res = await analyzeBedAllocationAction()
    setIsLoading(false)

    if (res.error) {
      setError(res.error)
    } else if (res.metrics) {
      setMetrics(res.metrics)
      const suggs = res.suggestions || []
      setSuggestions(suggs)
      // Domyślnie zaznaczamy wszystkie sugestie
      setSelectedIds(new Set(suggs.map((s) => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(suggestions.map((s) => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleExecuteRelocations = async () => {
    const toExecute = suggestions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({
        residentId: s.residentId,
        toBedId: s.toBedId,
        reason: s.reason,
      }))

    if (toExecute.length === 0) {
      setError('Wybierz co najmniej jedno przeniesienie do wykonania.')
      return
    }

    setIsExecuting(true)
    setError(null)

    const res = await executeBedRelocationAction(toExecute)
    setIsExecuting(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(`Pomyślnie wykonano ${res.executedCount} przeniesień. Przydział zaktualizowany.`)
      // Odśwież dane analizy i nadrzędny widok
      onAllocationChanged?.()
      setTimeout(() => {
        loadAnalysis()
      }, 1000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-slate-300 text-slate-700" />}>
        <Sparkles className="w-4 h-4 text-amber-500" />
        Optymalizator przydziału (AI)
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Optymalizator przydziału łóżek
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAnalysis}
              disabled={isLoading || isExecuting}
              className="gap-1.5 text-xs text-slate-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Przelicz ponownie
            </Button>
          </div>
          <DialogDescription className="text-sm text-slate-soft">
            Inteligentna weryfikacja obłożenia placówki pod kątem zgodności płciowej oraz poziomu mobilności.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-sage" />
            <p className="text-sm text-slate-500">
              Analizowanie struktury placówki, obłożenia i parametrów pensjonariuszy...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-5">
            {/* Metryki ogólne */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Wskaźnik jakości</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.overallScore >= 90
                        ? 'text-emerald-700'
                        : metrics.overallScore >= 70
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {metrics.overallScore}%
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Konflikty płci</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.genderConflictsCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {metrics.genderConflictsCount}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Bariery mobilności</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.mobilityMismatchCount > 0 ? 'text-amber-600' : 'text-emerald-700'
                    }`}
                  >
                    {metrics.mobilityMismatchCount}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Wolne łóżka</p>
                  <p className="text-xl font-bold text-slate-700">{metrics.freeBeds}</p>
                </div>
              </div>
            )}

            {/* Powiadomienia błędu lub sukcesu */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Informacja o braku konfliktów */}
            {suggestions.length === 0 && !isLoading && (
              <div className="p-6 text-center border rounded-xl bg-emerald-50/50 border-emerald-200/60 space-y-2">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-base font-semibold text-emerald-900">
                  Brak konfliktów alokacji
                </h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  Wszystkie pokoje wieloosobowe są zgodne płciowo, a pensjonariusze o ograniczonej mobilności przebywają na parterze.
                </p>
              </div>
            )}

            {/* Lista rekomendacji */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Rekomendowane przeniesienia ({suggestions.length})
                  </h4>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-sage focus:ring-sage"
                    />
                    <span>Zaznacz wszystkie</span>
                  </label>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => toggleSelect(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedIds.has(s.id)
                          ? 'bg-amber-50/40 border-amber-300 shadow-xs'
                          : 'bg-white border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => {}} // Handled by container onClick
                          className="mt-1 rounded border-slate-300 text-sage focus:ring-sage"
                        />

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 tracking-wide font-mono">
                              Pensjonariusz {s.residentPseudonym} ({s.gender === 'F' ? 'K' : 'M'})
                            </span>
                            <span
                              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                                s.priority === 'high'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              Priorytet: {s.priority === 'high' ? 'Wysoki' : 'Średni'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                              Pokój {s.fromRoomNumber} (P.{s.fromFloor}), Łóżko {s.fromBedLabel}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                              Pokój {s.toRoomNumber} (P.{s.toFloor}), Łóżko {s.toBedLabel}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 pt-0.5">{s.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Wybrano: {selectedIds.size} z {suggestions.length} propozycji
                  </p>
                  <Button
                    onClick={handleExecuteRelocations}
                    disabled={isExecuting || selectedIds.size === 0}
                    className="bg-sage hover:bg-sage/90 text-white gap-2 text-sm"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Zastosuj wybrane przeniesienia ({selectedIds.size})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
