import { Button } from '@/components/ui/button'
import { Download, AlertTriangle } from 'lucide-react'
import type { DryRunResult } from '@/lib/bulk-import-helpers'

export function BulkImportPreviewStats({
  dryRunResult,
  onDownloadTemplate,
}: {
  dryRunResult: DryRunResult
  onDownloadTemplate: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-4 text-sm">
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
        <div className="p-3 bg-muted border border-border rounded-lg text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary shrink-0" />
            <span>Część wierszy zawiera błędy formatu. Pobierz formatkę Excel, aby zweryfikować kolumny i wartości.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadTemplate}
            className="gap-1.5 text-sm bg-card shrink-0 h-7 text-foreground"
          >
            <Download className="w-3 h-3 text-foreground" />
            Pobierz formatkę Excel
          </Button>
        </div>
      )}
    </>
  )
}
