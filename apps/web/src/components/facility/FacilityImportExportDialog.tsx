'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileSpreadsheet,
  Download,
  Upload,
  Mic,
  Square,
  Check,
  AlertCircle,
  Loader2,
  AlertTriangle,
  FileCode,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react'
import {
  RawFacilityRoomRow,
  FacilityDryRunResult,
} from '@/lib/facility-helpers'
import {
  exportFacilityStructureAction,
  analyzeFacilityImportAction,
  commitFacilityImportAction,
  parseFacilityVoiceNoteAction,
  createRoomWithBedsAction,
} from '@/actions/facility'
import * as XLSX from 'xlsx'

interface FacilityImportExportDialogProps {
  onStructureChanged?: () => void
}

export function FacilityImportExportDialog({ onStructureChanged }: FacilityImportExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'voice'>('export')

  // EXPORT STATE
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  // IMPORT STATE
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<FacilityDryRunResult | null>(null)
  const [onlyValid, setOnlyValid] = useState(true)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // VOICE STATE
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceTranscription, setVoiceTranscription] = useState('')
  const [voiceRoomNumber, setVoiceRoomNumber] = useState('')
  const [voiceFloor, setVoiceFloor] = useState('')
  const [voiceSector, setVoiceSector] = useState('')
  const [voiceBedLabels, setVoiceBedLabels] = useState('')
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false)
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Reset dialog state
  const resetAllState = () => {
    setExportLoading(false)
    setExportError(null)
    setExportSuccess(null)
    setImportLoading(false)
    setImportError(null)
    setDryRunResult(null)
    setImportSuccess(null)
    setIsRecording(false)
    setIsProcessingVoice(false)
    setVoiceError(null)
    setVoiceTranscription('')
    setVoiceRoomNumber('')
    setVoiceFloor('')
    setVoiceSector('')
    setVoiceBedLabels('')
    setIsSubmittingVoice(false)
    setVoiceSuccess(null)
  }

  // --- EXPORT HANDLERS ---
  const handleDownloadTemplate = () => {
    const wsData = [
      ['Piętro', 'Numer pokoju', 'Sektor', 'Liczba łóżek', 'Etykiety łóżek'],
      ['Parter', '101', 'Skrzydło A', '2', '1, 2'],
      ['1', '201', 'Skrzydło B', '3', 'A, B, C'],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Pokoje i Łóżka')
    XLSX.writeFile(wb, 'szablon_struktury_placowki.xlsx')
  }

  const handleExportXLSX = async () => {
    setExportLoading(true)
    setExportError(null)
    setExportSuccess(null)

    const res = await exportFacilityStructureAction()
    setExportLoading(false)

    if (res.error) {
      setExportError(res.error)
      return
    }

    const rooms = res.rooms || []
    const flatRows: any[] = []

    for (const r of rooms) {
      if (r.beds.length === 0) {
        flatRows.push({
          'ID Pokoju': r.id,
          'Numer pokoju': r.number,
          'Piętro': r.floor,
          'Sektor': r.sector || '-',
          'Aktywny': r.is_active ? 'Tak' : 'Nie',
          'ID Łóżka': '-',
          'Etykieta łóżka': '-',
          'Status łóżka': '-',
          'Aktualny mieszkaniec': '-',
        })
      } else {
        for (const b of r.beds) {
          flatRows.push({
            'ID Pokoju': r.id,
            'Numer pokoju': r.number,
            'Piętro': r.floor,
            'Sektor': r.sector || '-',
            'Aktywny': r.is_active ? 'Tak' : 'Nie',
            'ID Łóżka': b.id,
            'Etykieta łóżka': b.label,
            'Status łóżka': b.occupied ? 'Zajęte' : 'Wolne',
            'Aktualny mieszkaniec': b.resident_name || '-',
          })
        }
      }
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(flatRows)
    XLSX.utils.book_append_sheet(wb, ws, 'Struktura Placówki')
    const dateStr = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `struktura_placowki_${dateStr}.xlsx`)

    setExportSuccess(`Pomyślnie wyeksportowano ${rooms.length} pokoi.`)
  }

  const handleExportJSON = async () => {
    setExportLoading(true)
    setExportError(null)
    setExportSuccess(null)

    const res = await exportFacilityStructureAction()
    setExportLoading(false)

    if (res.error) {
      setExportError(res.error)
      return
    }

    const blob = new Blob([res.json || '{}'], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `struktura_placowki_${dateStr}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setExportSuccess('Pomyślnie pobrano plik JSON ze strukturą.')
  }

  // --- IMPORT HANDLERS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

      if (jsonData.length < 2) {
        setImportError('Plik jest pusty lub zawiera tylko nagłówki.')
        setImportLoading(false)
        return
      }

      const rows: RawFacilityRoomRow[] = []
      // Pomijamy wiersz nagłówka
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i]
        if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === '')) {
          continue
        }
        rows.push({
          floor: row[0],
          number: row[1],
          sector: row[2],
          bedCount: row[3],
          bedLabels: row[4],
        })
      }

      if (rows.length === 0) {
        setImportError('Nie znaleziono wierszy z danymi w arkuszu.')
        setImportLoading(false)
        return
      }

      const res = await analyzeFacilityImportAction(rows)
      if (res.error) {
        setImportError(res.error)
      } else if (res.result) {
        setDryRunResult(res.result)
      }
    } catch (err: any) {
      setImportError('Błąd odczytu pliku: ' + (err?.message || 'Nieznany błąd'))
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCommitImport = async () => {
    if (!dryRunResult) return

    setImportLoading(true)
    setImportError(null)

    const rowsToProcess = onlyValid
      ? dryRunResult.rows.filter((r) => r.isValid)
      : dryRunResult.rows

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

  // --- VOICE HANDLERS ---
  const startRecording = async () => {
    try {
      setVoiceError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        audioChunksRef.current = []
        await processVoiceAudio(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      setVoiceError('Brak dostępu do mikrofonu. Upewnij się, że przyznano uprawnienia.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
      setIsRecording(false)
    }
  }

  const processVoiceAudio = async (blob: Blob) => {
    setIsProcessingVoice(true)
    setVoiceError(null)

    try {
      const formData = new FormData()
      formData.append('file', blob, 'facility_voice.webm')

      const transcribeRes = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      const transcribeData = await transcribeRes.json()
      if (!transcribeRes.ok || !transcribeData.text) {
        throw new Error(transcribeData.error || 'Nie udało się przetranskrybować nagrania')
      }

      const text = transcribeData.text
      setVoiceTranscription(text)

      // Wywołanie akcji LLM
      const parseRes = await parseFacilityVoiceNoteAction(text)
      if (parseRes.error) {
        throw new Error(parseRes.error)
      }

      if (parseRes.parsed) {
        if (parseRes.parsed.number) setVoiceRoomNumber(parseRes.parsed.number)
        if (parseRes.parsed.floor) setVoiceFloor(parseRes.parsed.floor)
        if (parseRes.parsed.sector) setVoiceSector(parseRes.parsed.sector)
        if (parseRes.parsed.bedLabels && parseRes.parsed.bedLabels.length > 0) {
          setVoiceBedLabels(parseRes.parsed.bedLabels.join(', '))
        }
      }
    } catch (err: any) {
      setVoiceError(err.message || 'Błąd przetwarzania głosu')
    } finally {
      setIsProcessingVoice(false)
    }
  }

  const handleManualTranscribeParse = async () => {
    if (!voiceTranscription.trim()) return
    setIsProcessingVoice(true)
    setVoiceError(null)

    try {
      const parseRes = await parseFacilityVoiceNoteAction(voiceTranscription)
      if (parseRes.error) {
        throw new Error(parseRes.error)
      }
      if (parseRes.parsed) {
        if (parseRes.parsed.number) setVoiceRoomNumber(parseRes.parsed.number)
        if (parseRes.parsed.floor) setVoiceFloor(parseRes.parsed.floor)
        if (parseRes.parsed.sector) setVoiceSector(parseRes.parsed.sector)
        if (parseRes.parsed.bedLabels && parseRes.parsed.bedLabels.length > 0) {
          setVoiceBedLabels(parseRes.parsed.bedLabels.join(', '))
        }
      }
    } catch (err: any) {
      setVoiceError(err.message || 'Błąd parsowania')
    } finally {
      setIsProcessingVoice(false)
    }
  }

  const handleSaveVoiceRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingVoice(true)
    setVoiceError(null)

    const labels = voiceBedLabels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await createRoomWithBedsAction({
      number: voiceRoomNumber,
      floor: voiceFloor,
      sector: voiceSector || null,
      bedLabels: labels,
    })

    setIsSubmittingVoice(false)

    if (res.error) {
      setVoiceError(res.error)
    } else {
      setVoiceSuccess(`Pomyślnie dodano pokój ${voiceRoomNumber} z ${labels.length} łóżkami.`)
      setVoiceRoomNumber('')
      setVoiceFloor('')
      setVoiceSector('')
      setVoiceBedLabels('')
      setVoiceTranscription('')
      onStructureChanged?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetAllState(); }}>
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-slate-300 text-slate-700" />}>
        <ArrowUpDown className="w-4 h-4 text-sage" />
        Import / Eksport / Głosowo
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate">
            <FileSpreadsheet className="w-5 h-5 text-sage" />
            Zarządzanie strukturą placówki
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-soft">
            Eksportuj, wgrywaj masowo lub dodawaj pokoje i łóżka za pomocą głosu.
          </DialogDescription>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex border-b border-slate-200 shrink-0 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-sage text-sage font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4 inline mr-1.5" />
            Eksport
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-sage text-sage font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-1.5" />
            Masowy import (Excel)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'voice'
                ? 'border-sage text-sage font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mic className="w-4 h-4 inline mr-1.5" />
            Głosowe dodawanie
          </button>
        </div>

        {/* Tab content wrapper with scroll */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* TAB 1: EKSPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800 mb-1">
                  Eksport pełnej struktury placówki
                </h4>
                <p className="text-xs text-slate-600 mb-4">
                  Pobierz aktualne dane o wszystkich pokojach, sektorach, łóżkach i przypisanych mieszkańcach.
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleExportXLSX}
                    disabled={exportLoading}
                    className="gap-2 bg-sage hover:bg-sage/90 text-white"
                  >
                    {exportLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    Pobierz arkusz Excel (.xlsx)
                  </Button>

                  <Button
                    onClick={handleExportJSON}
                    disabled={exportLoading}
                    variant="outline"
                    className="gap-2 border-slate-300 text-slate-700"
                  >
                    {exportLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileCode className="w-4 h-4" />
                    )}
                    Pobierz strukturę JSON
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">
                  Wzorcowy szablon importu
                </h4>
                <p className="text-xs text-amber-700 mb-3">
                  Potrzebujesz formatki do przygotowania danych pokoi? Pobierz czysty szablon z przykładowymi wierszami.
                </p>
                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  Pobierz szablon Excel (.xlsx)
                </Button>
              </div>

              {exportError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{exportError}</span>
                </div>
              )}

              {exportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{exportSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IMPORT EXCEL */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {!dryRunResult ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Wybierz lub przeciągnij plik Excel (.xlsx) lub CSV
                    </p>
                    <p className="text-xs text-slate-500 mb-4">
                      Kolumny: Piętro, Numer pokoju, Sektor (opcjonalnie), Liczba łóżek lub Etykiety łóżek
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      id="facility-import-input"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importLoading}
                      className="gap-2 bg-sage hover:bg-sage/90 text-white"
                    >
                      {importLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      Wybierz plik z dysku
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <div>
                      <span className="font-semibold text-slate-800">Podsumowanie analizy: </span>
                      <span className="text-emerald-700 font-medium">Poprawnych: {dryRunResult.validRowsCount}</span>
                      {dryRunResult.invalidRowsCount > 0 && (
                        <span className="text-rose-600 font-medium ml-2">
                          Błędnych: {dryRunResult.invalidRowsCount}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDryRunResult(null)}
                      className="text-xs text-slate-500"
                    >
                      Wgraj inny plik
                    </Button>
                  </div>

                  {/* Tabela podglądu dry-run */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2">Wiersz</th>
                          <th className="p-2">Piętro</th>
                          <th className="p-2">Pokój</th>
                          <th className="p-2">Sektor</th>
                          <th className="p-2">Łóżka</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dryRunResult.rows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={row.isValid ? 'bg-white' : 'bg-rose-50/50'}
                          >
                            <td className="p-2 font-mono text-slate-500">{row.rowNumber}</td>
                            <td className="p-2 font-medium">{row.floor || '-'}</td>
                            <td className="p-2 font-medium">{row.number || '-'}</td>
                            <td className="p-2 text-slate-600">{row.sector || '-'}</td>
                            <td className="p-2 font-mono">{row.bedLabels.join(', ') || '-'}</td>
                            <td className="p-2">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <Check className="w-3.5 h-3.5" /> Gotowy
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600" title={row.errors.join(' ')}>
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {row.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyValid}
                        onChange={(e) => setOnlyValid(e.target.checked)}
                        className="rounded border-slate-300 text-sage focus:ring-sage"
                      />
                      <span>Pomiń błędne wiersze i importuj tylko poprawne</span>
                    </label>

                    <Button
                      onClick={handleCommitImport}
                      disabled={importLoading || (onlyValid && dryRunResult.validRowsCount === 0)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-sm"
                    >
                      {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Zatwierdź import ({onlyValid ? dryRunResult.validRowsCount : dryRunResult.totalRows})
                    </Button>
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GŁOSOWE DODAWANIE */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      Podyktuj parametry nowego pokoju
                    </h4>
                    <p className="text-xs text-slate-500">
                      Np.: &quot;Dodaj pokój 205 na drugim piętrze, sektor B, z dwoma łóżkami A i B&quot;.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessingVoice}
                    variant={isRecording ? 'destructive' : 'default'}
                    className={`gap-2 ${!isRecording ? 'bg-sage hover:bg-sage/90 text-white' : ''}`}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        Zatrzymaj nagrywanie
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        Nagraj głosowo
                      </>
                    )}
                  </Button>
                </div>

                {isProcessingVoice && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-sage" />
                    <span>Przetwarzanie audio i ekstrakcja parametrów struktury...</span>
                  </div>
                )}

                {/* Transkrypcja / edycja tekstu */}
                <div className="mt-3">
                  <Label htmlFor="voice-transcript" className="text-xs font-medium text-slate-700 mb-1 block">
                    Transkrypcja lub polecenie słowne:
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="voice-transcript"
                      value={voiceTranscription}
                      onChange={(e) => setVoiceTranscription(e.target.value)}
                      placeholder="Możesz również wpisać polecenie słowne tutaj..."
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleManualTranscribeParse}
                      disabled={isProcessingVoice || !voiceTranscription.trim()}
                      className="gap-1 text-xs shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sage" />
                      Przetwórz AI
                    </Button>
                  </div>
                </div>
              </div>

              {/* Formularz weryfikacji i zatwierdzenia pokoju */}
              <form onSubmit={handleSaveVoiceRoom} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Wyodrębnione parametry pokoju (do weryfikacji)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="v-number" className="text-xs">Numer pokoju *</Label>
                    <Input
                      id="v-number"
                      value={voiceRoomNumber}
                      onChange={(e) => setVoiceRoomNumber(e.target.value)}
                      placeholder="np. 101 lub 205B"
                      required
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="v-floor" className="text-xs">Piętro *</Label>
                    <Input
                      id="v-floor"
                      value={voiceFloor}
                      onChange={(e) => setVoiceFloor(e.target.value)}
                      placeholder="np. Parter, 1, 2"
                      required
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="v-sector" className="text-xs">Sektor / Skrzydło (opcjonalnie)</Label>
                    <Input
                      id="v-sector"
                      value={voiceSector}
                      onChange={(e) => setVoiceSector(e.target.value)}
                      placeholder="np. Skrzydło A, Zachód"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="v-beds" className="text-xs">Etykiety łóżek (oddzielone przecinkami)</Label>
                    <Input
                      id="v-beds"
                      value={voiceBedLabels}
                      onChange={(e) => setVoiceBedLabels(e.target.value)}
                      placeholder="np. 1, 2 lub A, B"
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmittingVoice || !voiceRoomNumber.trim() || !voiceFloor.trim()}
                    className="bg-sage hover:bg-sage/90 text-white gap-2 text-sm"
                  >
                    {isSubmittingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Dodaj pokój i łóżka
                  </Button>
                </div>
              </form>

              {voiceError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{voiceError}</span>
                </div>
              )}

              {voiceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{voiceSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
