'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileSpreadsheet, Download, Check, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import { DryRunResult } from '@/lib/bulk-import-helpers'
import { parseBulkImportFile } from '@/lib/bulk-import-parser'
import { generateResidentTemplate } from '@/lib/bulk-import-template'
import { analyzeBulkImportAction, commitBulkImportAction } from '@/actions/bulk-import'
import { BulkImportPreviewTable } from '@/components/admission/BulkImportPreviewTable'
import { BulkImportUploadStep } from '@/components/admission/BulkImportUploadStep'
import { BulkImportSuccessStep } from '@/components/admission/BulkImportSuccessStep'
import { BulkImportPreviewStats } from '@/components/admission/BulkImportPreviewStats'

export function BulkImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [importCount, setImportCount] = useState<number>(0)
  const [onlyValid, setOnlyValid] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    generateResidentTemplate('formatka_importu_podopiecznych.xlsx', 'Instrukcja')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    const parsed = await parseBulkImportFile(file)
    if (parsed.error || !parsed.rows) {
      setError(parsed.error || 'Błąd przetwarzania pliku.')
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const res = await analyzeBulkImportAction(parsed.rows)
      if (res.error) {
        setError(res.error)
      } else if (res.result) {
        setDryRunResult(res.result)
        setStep('preview')
      }
    } catch (err: unknown) {
      setError('Błąd przetwarzania pliku: ' + (err instanceof Error ? err.message : 'Nieznany błąd.'))
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCommitImport = async () => {
    if (!dryRunResult) return
    setLoading(true)
    setError(null)

    const rowsToProcess = onlyValid ? dryRunResult.rows.filter((r) => r.isValid) : dryRunResult.rows
    const res = await commitBulkImportAction(rowsToProcess)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setImportCount(res.importedCount || 0)
      setStep('success')
      setTimeout(() => {
        setOpen(false)
        resetState()
        window.location.reload()
      }, 1800)
    }
  }

  const resetState = () => {
    setStep('upload')
    setLoading(false)
    setError(null)
    setDryRunResult(null)
    setImportCount(0)
    setOnlyValid(true)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger render={<Button variant="outline" data-testid="bulk-import-trigger" className="gap-2 border-border text-foreground" />}>
        <FileSpreadsheet className="w-4 h-4 text-foreground" />
        Masowy import (Excel/CSV)
      </DialogTrigger>
      <DialogContent data-testid="bulk-import-dialog" className="max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-foreground" />
            Masowy import podopiecznych
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Wgraj plik arkusza kalkulacyjnego (.xlsx lub .csv) z listą podopiecznych.'}
            {step === 'preview' && 'Podgląd i weryfikacja poprawności wierszy przed zapisem do bazy.'}
            {step === 'success' && 'Import zakończony sukcesem.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="bulk-download-template"
              onClick={handleDownloadTemplate}
              className="gap-1.5 text-sm bg-card shrink-0 h-8 text-foreground"
            >
              <Download className="w-3.5 h-3.5 text-foreground" />
              Pobierz formatkę Excel (.xlsx)
            </Button>
          </div>
        )}

        {step === 'upload' && (
          <BulkImportUploadStep
            loading={loading}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
            handleDownloadTemplate={handleDownloadTemplate}
          />
        )}

        {step === 'preview' && dryRunResult && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <BulkImportPreviewStats
              dryRunResult={dryRunResult}
              onDownloadTemplate={handleDownloadTemplate}
            />

            {dryRunResult.willExceedLimit && (
              <div
                data-testid="capacity-warning-banner"
                className="p-3 bg-muted border border-border rounded-lg text-sm flex items-start gap-3 text-foreground"
              >
                <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>Ostrzeżenie: import przekroczy limit miejsc placówki</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Liczba podopiecznych po zaimportowaniu ({dryRunResult.projectedTotal}) przekroczy limit miejsc placówki ({dryRunResult.residentLimit}) o{' '}
                    <strong className="text-foreground">{dryRunResult.excessCount}</strong>.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Limit miejsc pozostanie bez zmian — zmienia go wyłącznie Administrator platformy. Przekroczenie zostanie odnotowane w rejestrze audytowym.
                  </p>
                </div>
              </div>
            )}

            <BulkImportPreviewTable rows={dryRunResult.rows} />

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="only-valid-check"
                checked={onlyValid}
                onChange={(e) => setOnlyValid(e.target.checked)}
                className="rounded border-border text-foreground"
              />
              <label htmlFor="only-valid-check" className="text-sm text-foreground cursor-pointer">
                Importuj wyłącznie poprawne rekordy (pomiń {dryRunResult.invalidRowsCount} błędnych)
              </label>
            </div>
          </div>
        )}

        {step === 'success' && (
          <BulkImportSuccessStep
            importCount={importCount}
            capacityUpdated={null}
          />
        )}

        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2">
          {step === 'preview' ? (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep('upload')} disabled={loading}>
                Wstecz
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-sm">
                <Download className="w-3.5 h-3.5 text-foreground" />
                Pobierz formatkę Excel
              </Button>
            </div>
          ) : (
            <div />
          )}

          {step === 'preview' && (
            <Button
              type="button"
              size="sm"
              data-testid="bulk-commit-button"
              onClick={handleCommitImport}
              disabled={loading || (dryRunResult?.validRowsCount === 0 && onlyValid)}
              className="bg-primary hover:bg-primary text-white gap-2 w-full sm:w-auto"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading ? 'Zapisywanie...' : `Zatwierdź import (${onlyValid ? dryRunResult?.validRowsCount : dryRunResult?.totalRows})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
