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
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-border text-foreground" />}>
        <Sparkles className="w-4 h-4 text-foreground" />
        Optymalizator przydziału (AI)
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Sparkles className="w-5 h-5 text-foreground" />
              Optymalizator przydziału łóżek
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAnalysis}
              disabled={isLoading || isExecuting}
              className="gap-1.5 text-xs text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Przelicz ponownie
            </Button>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Inteligentna weryfikacja obłożenia placówki pod kątem zgodności płciowej oraz poziomu mobilności.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analizowanie struktury placówki, obłożenia i parametrów pensjonariuszy...
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-5">
            {/* Metryki ogólne */}
            {metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Wskaźnik jakości</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.overallScore >= 90
                        ? 'text-foreground'
                        : metrics.overallScore >= 70
                        ? 'text-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {metrics.overallScore}%
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Konflikty płci</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.genderConflictsCount > 0 ? 'text-foreground' : 'text-foreground'
                    }`}
                  >
                    {metrics.genderConflictsCount}
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Bariery mobilności</p>
                  <p
                    className={`text-xl font-bold ${
                      metrics.mobilityMismatchCount > 0 ? 'text-foreground' : 'text-foreground'
                    }`}
                  >
                    {metrics.mobilityMismatchCount}
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">Wolne łóżka</p>
                  <p className="text-xl font-bold text-foreground">{metrics.freeBeds}</p>
                </div>
              </div>
            )}

            {/* Powiadomienia błędu lub sukcesu */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 bg-muted border border-border text-foreground rounded-lg text-sm flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Informacja o braku konfliktów */}
            {suggestions.length === 0 && !isLoading && (
              <div className="p-6 text-center border rounded-xl bg-muted border-border space-y-2">
                <ShieldCheck className="w-10 h-10 text-foreground mx-auto" />
                <h4 className="text-base font-semibold text-foreground">
                  Brak konfliktów alokacji
                </h4>
                <p className="text-xs text-foreground max-w-md mx-auto">
                  Wszystkie pokoje wieloosobowe są zgodne płciowo, a pensjonariusze o ograniczonej mobilności przebywają na parterze.
                </p>
              </div>
            )}

            {/* Lista rekomendacji */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Rekomendowane przeniesienia ({suggestions.length})
                  </h4>
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
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
                          ? 'bg-muted border-border'
                          : 'bg-card border-border opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => {}} // Handled by container onClick
                          className="mt-1 rounded border-border text-primary focus:ring-primary"
                        />

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground tracking-wide font-mono">
                              Pensjonariusz {s.residentPseudonym} ({s.gender === 'F' ? 'K' : 'M'})
                            </span>
                            <span
                              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                                s.priority === 'high'
                                  ? 'bg-muted text-foreground'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              Priorytet: {s.priority === 'high' ? 'Wysoki' : 'Średni'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded-md font-medium">
                              Pokój {s.fromRoomNumber} (P.{s.fromFloor}), Łóżko {s.fromBedLabel}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="bg-muted text-foreground border border-border px-2 py-0.5 rounded-md font-medium">
                              Pokój {s.toRoomNumber} (P.{s.toFloor}), Łóżko {s.toBedLabel}
                            </span>
                          </div>

                          <p className="text-xs text-foreground pt-0.5">{s.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Wybrano: {selectedIds.size} z {suggestions.length} propozycji
                  </p>
                  <Button
                    onClick={handleExecuteRelocations}
                    disabled={isExecuting || selectedIds.size === 0}
                    className="bg-primary hover:bg-primary/90 text-white gap-2 text-sm"
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
