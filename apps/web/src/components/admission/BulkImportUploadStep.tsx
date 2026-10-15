import { Button } from '@/components/ui/button'
import { Download, Upload, Loader2 } from 'lucide-react'

export function BulkImportUploadStep({
  loading,
  fileInputRef,
  handleFileUpload,
  handleDownloadTemplate,
}: {
  loading: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleDownloadTemplate: () => void
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="bg-muted p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Wzorcowa formatka arkusza Excel</h4>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pobierz przygotowany plik z prawidłowymi kolumnami i arkuszem instrukcji, wklej dane i załaduj poniżej.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="bulk-download-template-main"
          onClick={handleDownloadTemplate}
          className="gap-2 text-sm bg-card shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-foreground" />
          Pobierz formatkę Excel (.xlsx)
        </Button>
      </div>

      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          data-testid="bulk-file-input"
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
          <p className="text-sm text-muted-foreground">Obsługiwane formaty: Excel 2007+ (.xlsx) oraz CSV</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleDownloadTemplate()
            }}
            className="mt-1 text-sm text-primary underline hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            Nie masz pliku? Pobierz formatkę Excel (.xlsx)
          </button>
        </label>
      </div>
    </div>
  )
}
