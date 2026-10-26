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
  Shuffle,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'
import type {
  FacilityAllocationMetrics,
  RelocationSuggestion,
} from '@/lib/bed-allocation-optimizer'
import {
  analyzeBedAllocationAction,
  executeBedRelocationAction,
} from '@/actions/bed-allocation'
import { BedOptimizerMetricsView } from './BedOptimizerMetricsView'
import { BedOptimizerSuggestionsList } from './BedOptimizerSuggestionsList'

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
      onAllocationChanged?.()
      setTimeout(() => {
        loadAnalysis()
      }, 1000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-border text-foreground" />}>
        <Shuffle className="w-4 h-4 text-foreground" />
        Optymalizuj przydział łóżek
      </DialogTrigger>
      <DialogContent className="max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Shuffle className="w-5 h-5 text-foreground" />
              Optymalizacja przydziału łóżek
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAnalysis}
              disabled={isLoading || isExecuting}
              className="gap-1.5 text-sm text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Przelicz ponownie
            </Button>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Sprawdza zgodność płci w pokojach wieloosobowych i to, czy osoby o ograniczonej mobilności mają łóżko na parterze.
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
          <div data-testid="bed-optimizer-result" className="flex-1 overflow-y-auto pr-1 space-y-5">
            {metrics && <BedOptimizerMetricsView metrics={metrics} />}

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

            {suggestions.length === 0 && !isLoading && (
              <div className="p-6 text-center border rounded-xl bg-muted border-border space-y-2">
                <ShieldCheck className="w-10 h-10 text-foreground mx-auto" />
                <h4 className="text-base font-semibold text-foreground">
                  Brak konfliktów alokacji
                </h4>
                <p className="text-sm text-foreground max-w-md mx-auto">
                  Wszystkie pokoje wieloosobowe są zgodne płciowo, a pensjonariusze o ograniczonej mobilności przebywają na parterze.
                </p>
              </div>
            )}

            {suggestions.length > 0 && (
              <BedOptimizerSuggestionsList
                suggestions={suggestions}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                handleSelectAll={handleSelectAll}
                handleExecuteRelocations={handleExecuteRelocations}
                isExecuting={isExecuting}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
