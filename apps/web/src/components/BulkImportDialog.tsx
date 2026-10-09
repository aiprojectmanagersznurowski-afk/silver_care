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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function BulkImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
  const [importCount, setImportCount] = useState<number>(0)
  const [onlyValid, setOnlyValid] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generowanie i pobranie wzorcowej formatki Excel wraz z arkuszem instrukcji
  const handleDownloadTemplate = () => {
    const wsData = [
      ['Imię', 'Nazwisko', 'PESEL', 'Stan', 'ZSN', 'Uwagi'],
      ['Jan', 'Kowalski', '44051401458', 'chodzący', 'nie', 'Samodzielny'],
      ['Anna', 'Nowak', '52081203447', 'siedzący', 'tak', 'Wymaga asekuracji przy wstawaniu'],
      ['Stanisław', 'Wiśniewski', '38031502491', 'leżący', 'tak', 'Wymaga regularnej zmiany pozycji'],
    ]
    const instructionsData = [
      ['Kolumna', 'Wymagana?', 'Opis i dozwolone formaty'],
      ['Imię', 'TAK', 'Imię podopiecznego (tekst, np. Jan)'],
      ['Nazwisko', 'TAK', 'Nazwisko podopiecznego (tekst, np. Kowalski)'],
      ['PESEL', 'TAK', 'Dokładnie 11 cyfr, prawidłowa suma kontrolna. Na tej podstawie system automatycznie wylicza datę urodzenia i płeć.'],
      ['Stan', 'NIE', 'Dopuszczalne wartości: chodzący, siedzący, leżący, paliatywny. Domyślnie: chodzący.'],
      ['ZSN', 'NIE', 'Zespół Stacjonarnej Niedyspozycji: tak / nie (lub 1 / 0). Domyślnie: nie.'],
      ['Uwagi', 'NIE', 'Dowolny tekst z uwagami opiekuńczymi, alergiami lub zaleceniami.'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wsInstrukcja = XLSX.utils.aoa_to_sheet(instructionsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Podopieczni')
    XLSX.utils.book_append_sheet(wb, wsInstrukcja, 'Instrukcja')
    XLSX.writeFile(wb, 'formatka_importu_podopiecznych.xlsx')
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
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-border text-foreground" />}>
        <FileSpreadsheet className="w-4 h-4 text-foreground" />
        Masowy import (Excel/CSV)
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-foreground" />
            Masowy import pensjonariuszy
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Wgraj plik arkusza kalkulacyjnego (.xlsx lub .csv) z listą pensjonariuszy.'}
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
              onClick={handleDownloadTemplate}
              className="gap-1.5 text-xs bg-card shrink-0 h-8 text-foreground"
            >
              <Download className="w-3.5 h-3.5 text-foreground" />
              Pobierz formatkę Excel (.xlsx)
            </Button>
          </div>
        )}

        {/* KROK 1: UPLOAD & SZABLON */}
        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="bg-muted p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Wzorcowa formatka arkusza Excel</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pobierz przygotowany plik z prawidłowymi kolumnami i arkuszem instrukcji, wklej dane i załaduj poniżej.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs bg-card shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-foreground" />
                Pobierz formatkę Excel (.xlsx)
              </Button>
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-file-input"
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-muted text-foreground flex items-center justify-center">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {loading ? 'Analizowanie pliku...' : 'Kliknij, aby wybrać plik .xlsx lub .csv'}
                </div>
                <p className="text-xs text-muted-foreground">Obsługiwane formaty: Excel 2007+ (.xlsx) oraz CSV</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownloadTemplate();
                  }}
                  className="mt-1 text-xs text-primary underline hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Nie masz pliku? Pobierz formatkę Excel (.xlsx)
                </button>
              </label>
            </div>
          </div>
        )}

        {/* KROK 2: PREVIEW */}
        {step === 'preview' && dryRunResult && (
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4 text-xs">
              <div className="p-2.5 rounded-lg bg-muted flex-1">
                <span className="text-muted-foreground block">Wszystkich wierszy</span>
                <span className="font-semibold text-base text-foreground">{dryRunResult.totalRows}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted border border-border flex-1">
                <span className="text-foreground block">Poprawne do importu</span>
                <span className="font-semibold text-base text-foreground">{dryRunResult.validRowsCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex-1">
                <span className="text-destructive block">Zawierające błędy</span>
                <span className="font-semibold text-base text-destructive">{dryRunResult.invalidRowsCount}</span>
              </div>
            </div>

            {dryRunResult.invalidRowsCount > 0 && (
              <div className="p-3 bg-muted border border-border rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
                  <span>Część wierszy zawiera błędy formatu. Pobierz formatkę Excel, aby zweryfikować kolumny i wartości.</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="gap-1.5 text-xs bg-card shrink-0 h-7 text-foreground"
                >
                  <Download className="w-3 h-3 text-foreground" />
                  Pobierz formatkę Excel
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto border border-border rounded-lg max-h-64">
              <Table>
                <TableHeader className="bg-muted text-foreground sticky top-0">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Imię i nazwisko</TableHead>
                    <TableHead>PESEL</TableHead>
                    <TableHead>Profil</TableHead>
                    <TableHead>Status / Błędy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dryRunResult.rows.map((r) => (
                    <TableRow key={r.rowNumber} className={r.isValid ? 'bg-card' : 'bg-destructive/5'}>
                      <TableCell className="font-mono text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {r.firstName} {r.lastName}
                      </TableCell>
                      <TableCell className="font-mono">{r.nationalId || '—'}</TableCell>
                      <TableCell>{r.careLevel} {r.isZsn ? '(ZSN)' : ''}</TableCell>
                      <TableCell>
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-foreground font-medium">
                            <Check className="w-3.5 h-3.5" /> Poprawny
                          </span>
                        ) : (
                          <div className="text-destructive space-y-0.5">
                            {r.errors.map((err, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="only-valid-check"
                checked={onlyValid}
                onChange={(e) => setOnlyValid(e.target.checked)}
                className="rounded border-border text-foreground"
              />
              <label htmlFor="only-valid-check" className="text-xs text-foreground cursor-pointer">
                Importuj wyłącznie poprawne rekordy (pomiń {dryRunResult.invalidRowsCount} błędnych)
              </label>
            </div>
          </div>
        )}

        {/* KROK 3: SUKCES */}
        {step === 'success' && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted text-foreground flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Pomyślnie zaimportowano {importCount} pensjonariuszy!
            </h3>
            <p className="text-xs text-muted-foreground">
              Dane zostały zabezpieczone, a lista placówki została zaktualizowana.
            </p>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2">
          {step === 'preview' ? (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep('upload')}
                disabled={loading}
              >
                Wstecz
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-1.5 text-xs"
              >
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
