'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileCode, Download, Loader2, Check, AlertCircle } from 'lucide-react'
import { exportFacilityStructureAction } from '@/actions/facility'
import * as XLSX from 'xlsx'

interface FacilityExportTabProps {
  handleDownloadTemplate: () => void
}

export function FacilityExportTab({ handleDownloadTemplate }: FacilityExportTabProps) {
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

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
    const flatRows: Record<string, unknown>[] = []

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
          'Aktualny podopieczny': '-',
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
            'Aktualny podopieczny': b.resident_name || '-',
          })
        }
      }
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(flatRows)
    XLSX.utils.book_append_sheet(wb, ws, 'Struktura placówki')
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

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-xl border border-border">
        <h4 className="text-sm font-semibold text-foreground mb-1">
          Eksportuj aktualną strukturę placówki
        </h4>
        <p className="text-sm text-muted-foreground mb-4">
          Pobierz listę wszystkich pokoi i łóżek wraz z aktualnym obłożeniem w wybranym formacie.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleExportXLSX}
            disabled={exportLoading}
            className="gap-2 bg-primary hover:bg-primary/90 text-white"
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
            className="gap-2 border-border text-foreground"
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

      <div className="p-4 bg-muted rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Wzorcowa formatka arkusza (Pokoje i Łóżka)
          </h4>
          <p className="text-sm text-muted-foreground">
            Potrzebujesz formatki do przygotowania danych pokoi? Pobierz czysty szablon z arkuszem instrukcji.
          </p>
        </div>
        <Button
          onClick={handleDownloadTemplate}
          variant="outline"
          size="sm"
          className="gap-2 border-border text-foreground hover:bg-muted bg-card shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-foreground" />
          Pobierz formatkę Excel (.xlsx)
        </Button>
      </div>

      {exportError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3 bg-muted border border-border text-foreground rounded-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{exportSuccess}</span>
        </div>
      )}
    </div>
  )
}
