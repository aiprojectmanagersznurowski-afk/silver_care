'use client'

import { useState } from 'react'
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
import { Download, FileSpreadsheet, FileText, Check, AlertCircle, Loader2 } from 'lucide-react'
import { exportResidentsDataAction } from '@/actions/export'
import * as XLSX from 'xlsx'

export function ExportDataDialog() {
  const [open, setOpen] = useState(false)
  const [formatType, setFormatType] = useState<'xlsx' | 'csv'>('xlsx')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [zsnOnly, setZsnOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const res = await exportResidentsDataAction({
      status: statusFilter,
      zsnOnly,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    const rows = res.rows || []
    if (rows.length === 0) {
      setError('Brak rekordów spełniających wybrane kryteria eksportu.')
      return
    }

    const dateStr = new Date().toISOString().split('T')[0]

    if (formatType === 'csv') {
      const blob = new Blob([res.csvContent || ''], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `zestawienie_placowki_${dateStr}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Podopieczni')
      XLSX.writeFile(wb, `zestawienie_placowki_${dateStr}.xlsx`)
    }

    setSuccessMessage(`Wyeksportowano pomyślnie ${rows.length} wierszy.`)
    setTimeout(() => {
      setOpen(false)
      setSuccessMessage(null)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-2 border-slate-300 text-slate-700" />}>
        <Download className="w-4 h-4 text-sage" />
        Eksportuj dane
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-sage" />
            Eksport danych placówki
          </DialogTitle>
          <DialogDescription>
            Wygeneruj zestawienie podopiecznych i stanu placówki w formacie arkusza kalkulacyjnego.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-4 py-2 text-sm text-slate-700">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">Format pliku</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormatType('xlsx')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  formatType === 'xlsx'
                    ? 'border-sage bg-sage/5 ring-1 ring-sage text-slate-900 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatType('csv')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  formatType === 'csv'
                    ? 'border-sage bg-sage/5 ring-1 ring-sage text-slate-900 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>CSV (UTF-8 BOM)</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 block">Status pensjonariuszy</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'archived' | 'all')}
              className="w-full px-3 py-2 border rounded-md text-sm bg-white border-slate-200"
            >
              <option value="active">Tylko aktywni (obecnie w placówce)</option>
              <option value="archived">Tylko wypisani / zarchiwizowani</option>
              <option value="all">Wszyscy (obecni i archiwalni)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="export-zsn-only"
              checked={zsnOnly}
              onChange={(e) => setZsnOnly(e.target.checked)}
              className="rounded border-slate-300 text-sage focus:ring-sage"
            />
            <label htmlFor="export-zsn-only" className="text-xs text-slate-700 cursor-pointer">
              Eksportuj wyłącznie pensjonariuszy z pakietem ZSN
            </label>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">Ochrona prywatności i MDR:</p>
            <p>Zgodnie z procedurami Silver Care, plik nie zawiera surowych danych biometrycznych ani medycznych. Operacja pobrania zostanie zapisana w rejestrze audytowym.</p>
          </div>
        </div>

        <DialogFooter className="flex justify-end items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={loading}
            className="bg-sage hover:bg-sage/90 text-white gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Generowanie...' : 'Pobierz plik'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
