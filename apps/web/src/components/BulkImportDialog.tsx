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
import { FileSpreadsheet, Download, Upload, Check, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import { RawResidentRow, ValidatedResidentRow, DryRunResult } from '@/lib/bulk-import-helpers'
import { analyzeBulkImportAction, commitBulkImportAction } from '@/actions/bulk-import'
import * as XLSX from 'xlsx'

export function BulkImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [importCount, setImportCount] = useState<number>(0)
  const [onlyValid, setOnlyValid] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generowanie i pobranie wzorcowego szablonu Excel
  const handleDownloadTemplate = () => {
    const wsData = [
      ['Imię', 'Nazwisko', 'PESEL', 'Stan', 'ZSN', 'Uwagi'],
      ['Jan', 'Kowalski', '44051401458', 'chodzący', 'nie', 'Alergia na orzechy'],
      ['Anna', 'Nowak', '52081203447', 'siedzący', 'tak', 'Wymaga asekuracji przy wstawaniu'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Podopieczni')
    XLSX.writeFile(wb, 'szablon_importu_pensjonariuszy.xlsx')
  }

  // Parsowanie wgranego pliku XLSX lub CSV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      if (jsonData.length < 2) {
        setError('Plik jest pusty lub zawiera tylko nagłówki.')
        setLoading(false)
        return
      }

      const rows: RawResidentRow[] = []
      // Pomijamy nagłówek (indeks 0)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === '')) {
          continue
        }
        rows.push({
          firstName: row[0],
          lastName: row[1],
          nationalId: row[2],
          careLevel: row[3],
          isZsn: row[4],
          notes: row[5],
        })
      }

      if (rows.length === 0) {
        setError('Nie znaleziono wierszy z danymi w arkuszu.')
        setLoading(false)
        return
      }

      const res = await analyzeBulkImportAction(rows)
      if (res.error) {
        setError(res.error)
      } else if (res.result) {
        setDryRunResult(res.result)
        setStep('preview')
      }
    } catch (err: any) {
      setError('Błąd przetwarzania pliku: ' + (err?.message || 'Nieznany błąd.'))
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Zatwierdzenie importu
  const handleCommitImport = async () => {
    if (!dryRunResult) return

    setLoading(true)
    setError(null)

    const rowsToProcess = onlyValid
      ? dryRunResult.rows.filter((r) => r.isValid)
      : dryRunResult.rows

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
      }, 1500)
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
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-slate-300 text-slate-700" />}>
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        Masowy import (Excel/CSV)
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Masowy import pensjonariuszy
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Wgraj plik arkusza kalkulacyjnego (.xlsx lub .csv) z listą pensjonariuszy.'}
            {step === 'preview' && 'Podgląd i weryfikacja poprawności wierszy przed zapisem do bazy.'}
            {step === 'success' && 'Import zakończony sukcesem.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* KROK 1: UPLOAD & SZABLON */}
        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Wzorcowy szablon arkusza</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pobierz przygotowany plik z prawidłowymi nagłówkami kolumn.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs bg-white"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Pobierz szablon .XLSX
              </Button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-file-input"
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-sm font-medium text-slate-700">
                  {loading ? 'Analizowanie pliku...' : 'Kliknij, aby wybrać plik .xlsx lub .csv'}
                </div>
                <p className="text-xs text-slate-400">Obsługiwane formaty: Excel 2007+ (.xlsx) oraz CSV</p>
              </label>
            </div>
          </div>
        )}

        {/* KROK 2: PREVIEW */}
        {step === 'preview' && dryRunResult && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-100 flex-1">
                <span className="text-slate-500 block">Wszystkich wierszy</span>
                <span className="font-semibold text-base text-slate-800">{dryRunResult.totalRows}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex-1">
                <span className="text-emerald-700 block">Poprawne do importu</span>
                <span className="font-semibold text-base text-emerald-800">{dryRunResult.validRowsCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex-1">
                <span className="text-rose-700 block">Zawierające błędy</span>
                <span className="font-semibold text-base text-rose-800">{dryRunResult.invalidRowsCount}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg max-h-64">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b">
                  <tr>
                    <th className="p-2 w-10">#</th>
                    <th className="p-2">Imię i nazwisko</th>
                    <th className="p-2">PESEL</th>
                    <th className="p-2">Profil</th>
                    <th className="p-2">Status / Błędy</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dryRunResult.rows.map((r) => (
                    <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-rose-50/40'}>
                      <td className="p-2 font-mono text-slate-400">{r.rowNumber}</td>
                      <td className="p-2 font-medium text-slate-800">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="p-2 font-mono">{r.nationalId || '—'}</td>
                      <td className="p-2">{r.careLevel} {r.isZsn ? '(ZSN)' : ''}</td>
                      <td className="p-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <Check className="w-3.5 h-3.5" /> Poprawny
                          </span>
                        ) : (
                          <div className="text-rose-600 space-y-0.5">
                            {r.errors.map((err, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="only-valid-check"
                checked={onlyValid}
                onChange={(e) => setOnlyValid(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <label htmlFor="only-valid-check" className="text-xs text-slate-700 cursor-pointer">
                Importuj wyłącznie poprawne rekordy (pomiń {dryRunResult.invalidRowsCount} błędnych)
              </label>
            </div>
          </div>
        )}

        {/* KROK 3: SUKCES */}
        {step === 'success' && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              Pomyślnie zaimportowano {importCount} pensjonariuszy!
            </h3>
            <p className="text-xs text-slate-500">
              Dane zostały zabezpieczone, a lista placówki została zaktualizowana.
            </p>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between items-center pt-2">
          {step === 'preview' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep('upload')}
              disabled={loading}
            >
              Wstecz
            </Button>
          ) : (
            <div />
          )}

          {step === 'preview' && (
            <Button
              type="button"
              size="sm"
              onClick={handleCommitImport}
              disabled={loading || (dryRunResult?.validRowsCount === 0 && onlyValid)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
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
