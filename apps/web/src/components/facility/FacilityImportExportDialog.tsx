'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileSpreadsheet, Download, Upload, Check, AlertCircle, Loader2, ArrowUpDown, Mic } from 'lucide-react'
import { RawFacilityRoomRow, FacilityDryRunResult } from '@/lib/facility-helpers'
import { analyzeFacilityImportAction, commitFacilityImportAction } from '@/actions/facility'
import * as XLSX from 'xlsx'
import { FacilityExportTab } from './FacilityExportTab'
import { FacilityVoiceTab } from './FacilityVoiceTab'
import { FacilityDryRunTable } from './FacilityDryRunTable'

interface FacilityImportExportDialogProps {
  onStructureChanged?: () => void
}

export function FacilityImportExportDialog({ onStructureChanged }: FacilityImportExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'voice'>('export')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<FacilityDryRunResult | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [onlyValid, setOnlyValid] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const wsData = [
      ['Piętro', 'Numer pokoju', 'Sektor', 'Liczba łóżek', 'Etykiety łóżek'],
      ['Parter', '101', 'Skrzydło A', '2', '1, 2'],
      ['1', '201', 'Skrzydło B', '3', 'A, B, C'],
      ['2', '305', 'Główne', '1', '1'],
    ]
    const instructionsData = [
      ['Kolumna', 'Wymagana?', 'Opis i dozwolone formaty'],
      ['Piętro', 'TAK', 'Oznaczenie piętra lub kondygnacji (tekst, np. Parter, 1, 2, Niski parter)'],
      ['Numer pokoju', 'TAK', 'Numer lub symbol pokoju (unikalny w placówce, np. 101, 204A)'],
      ['Sektor', 'NIE', 'Opcjonalna nazwa skrzydła lub sektora (tekst, np. Skrzydło A, Pawilon 2)'],
      ['Liczba łóżek', 'NIE', 'Liczba łóżek w pokoju (liczba całkowita, np. 2)'],
      ['Etykiety łóżek', 'NIE', 'Etykiety łóżek oddzielone przecinkami (np. "1, 2" lub "A, B, C"). Jeśli podano liczbę łóżek bez etykiet, system wygeneruje etykiety automatycznie.'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wsInstrukcja = XLSX.utils.aoa_to_sheet(instructionsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Pokoje i Łóżka')
    XLSX.utils.book_append_sheet(wb, wsInstrukcja, 'Instrukcja')
    XLSX.writeFile(wb, 'formatka_struktury_placowki.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const jsonData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
      if (jsonData.length < 2) {
        setImportError('Plik jest pusty lub zawiera tylko nagłówki.')
        setImportLoading(false)
        return
      }
      const rows: RawFacilityRoomRow[] = []
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === '')) continue
        rows.push({
          floor: row[0] != null ? String(row[0]) : undefined,
          number: row[1] != null ? String(row[1]) : undefined,
          sector: row[2] != null ? String(row[2]) : undefined,
          bedCount: row[3] != null ? (typeof row[3] === 'number' ? row[3] : String(row[3])) : undefined,
          bedLabels: row[4] != null ? String(row[4]) : undefined,
        })
      }
      if (rows.length === 0) {
        setImportError('Nie znaleziono wierszy z danymi w arkuszu.')
        setImportLoading(false)
        return
      }
      const res = await analyzeFacilityImportAction(rows)
      if (res.error) setImportError(res.error)
      else if (res.result) setDryRunResult(res.result)
    } catch (err: unknown) {
      setImportError('Błąd odczytu pliku: ' + (err instanceof Error ? err.message : 'Nieznany błąd'))
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCommitImport = async () => {
    if (!dryRunResult) return
    setImportLoading(true)
    setImportError(null)
    const rowsToProcess = onlyValid ? dryRunResult.rows.filter((r) => r.isValid) : dryRunResult.rows
    if (rowsToProcess.length === 0) {
      setImportError('Brak poprawnych wierszy do zaimportowania.')
      setImportLoading(false)
      return
    }
    const res = await commitFacilityImportAction(rowsToProcess)
    setImportLoading(false)
    if (res.error) {
      setImportError(res.error)
    } else {
      setImportSuccess(`Zaimportowano pomyślnie ${res.importedRooms} pokoi oraz ${res.importedBeds} łóżek.`)
      setDryRunResult(null)
      onStructureChanged?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-border text-foreground hover:bg-muted bg-card" />}>
        <ArrowUpDown className="w-4 h-4 text-foreground" />
        Import / Eksport
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Zarządzanie strukturą placówki (Import / Eksport)
          </DialogTitle>
          <DialogDescription>
            Eksportuj pokoje do arkusza lub importuj masowo strukturę z pliku Excel. Możesz też podyktować pokój głosowo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border space-x-2 my-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'export' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" /> Eksport</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5"><Upload className="w-4 h-4" /> Import Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'voice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5"><Mic className="w-4 h-4" /> Dodaj głosowo</span>
          </button>
        </div>

        <div className="py-2">
          {activeTab === 'export' && <FacilityExportTab handleDownloadTemplate={handleDownloadTemplate} />}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {!dryRunResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Wzorcowa formatka arkusza (Pokoje i Łóżka)</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Pobierz przygotowany plik z prawidłowymi kolumnami i arkuszem instrukcji.
                      </p>
                    </div>
                    <Button type="button" onClick={handleDownloadTemplate} variant="outline" size="sm" className="gap-2 border-border text-foreground hover:bg-muted shrink-0 bg-card">
                      <Download className="w-3.5 h-3.5 text-foreground" />
                      Pobierz formatkę Excel (.xlsx)
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted hover:bg-muted transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Wybierz plik Excel (.xlsx) lub CSV</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" id="facility-import-input" />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="gap-2 bg-primary hover:bg-primary/90 text-white">
                      {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Wybierz plik z dysku
                    </Button>
                    <div className="mt-3">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadTemplate(); }} className="text-sm text-primary underline hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer">
                        <Download className="w-3 h-3" /> Nie masz pliku? Pobierz formatkę Excel (.xlsx)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <FacilityDryRunTable
                  dryRunResult={dryRunResult}
                  onlyValid={onlyValid}
                  setOnlyValid={setOnlyValid}
                  handleCommitImport={handleCommitImport}
                  importLoading={importLoading}
                  handleDownloadTemplate={handleDownloadTemplate}
                  onResetFile={() => setDryRunResult(null)}
                />
              )}

              {importError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-sm bg-card shrink-0 h-8 text-foreground">
                    <Download className="w-3.5 h-3.5" /> Pobierz formatkę Excel
                  </Button>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-muted border border-border text-foreground rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" /> <span>{importSuccess}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'voice' && <FacilityVoiceTab onStructureChanged={onStructureChanged} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
