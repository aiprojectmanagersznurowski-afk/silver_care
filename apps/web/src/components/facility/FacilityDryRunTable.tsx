'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Download, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FacilityDryRunResult } from '@/lib/facility-helpers'

interface FacilityDryRunTableProps {
  dryRunResult: FacilityDryRunResult
  onlyValid: boolean
  setOnlyValid: (val: boolean) => void
  handleCommitImport: () => void
  importLoading: boolean
  handleDownloadTemplate: () => void
  onResetFile: () => void
}

export function FacilityDryRunTable({
  dryRunResult,
  onlyValid,
  setOnlyValid,
  handleCommitImport,
  importLoading,
  handleDownloadTemplate,
  onResetFile,
}: FacilityDryRunTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted rounded-lg border border-border text-sm gap-2">
        <div>
          <span className="font-semibold text-foreground">Podsumowanie analizy: </span>
          <span className="text-foreground font-medium">Poprawnych: {dryRunResult.validRowsCount}</span>
          {dryRunResult.invalidRowsCount > 0 && (
            <span className="text-destructive font-medium ml-2">
              Błędnych: {dryRunResult.invalidRowsCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="text-xs gap-1.5 bg-card"
          >
            <Download className="w-3 h-3 text-foreground" />
            Pobierz formatkę Excel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFile}
            className="text-xs text-muted-foreground"
          >
            Wgraj inny plik
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto max-h-56">
        <Table>
          <TableHeader className="bg-muted text-foreground sticky top-0">
            <TableRow>
              <TableHead>Wiersz</TableHead>
              <TableHead>Piętro</TableHead>
              <TableHead>Pokój</TableHead>
              <TableHead>Sektor</TableHead>
              <TableHead>Łóżka</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dryRunResult.rows.map((row) => (
              <TableRow key={row.rowNumber} className={row.isValid ? 'bg-card' : 'bg-destructive/5'}>
                <TableCell className="font-mono text-muted-foreground">{row.rowNumber}</TableCell>
                <TableCell className="font-medium">{row.floor || '-'}</TableCell>
                <TableCell className="font-medium">{row.number || '-'}</TableCell>
                <TableCell className="text-foreground">{row.sector || '-'}</TableCell>
                <TableCell className="font-mono">{row.bedLabels.join(', ') || '-'}</TableCell>
                <TableCell>
                  {row.isValid ? (
                    <span className="inline-flex items-center gap-1 text-foreground font-medium">
                      <Check className="w-3.5 h-3.5" /> Gotowy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-destructive" title={row.errors.join(' ')}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {row.errors[0]}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={onlyValid}
            onChange={(e) => setOnlyValid(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span>Pomiń błędne wiersze i importuj tylko poprawne</span>
        </label>

        <Button
          onClick={handleCommitImport}
          disabled={importLoading || (onlyValid && dryRunResult.validRowsCount === 0)}
          className="bg-primary hover:bg-primary text-white gap-2 text-sm"
        >
          {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Zatwierdź import ({onlyValid ? dryRunResult.validRowsCount : dryRunResult.totalRows})
        </Button>
      </div>
    </div>
  )
}
