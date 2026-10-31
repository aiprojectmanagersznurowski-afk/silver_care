import { Check } from 'lucide-react'

export function BulkImportSuccessStep({
  importCount,
  capacityUpdated,
}: {
  importCount: number
  capacityUpdated: { updated: boolean; newCapacity: number } | null
}) {
  return (
    <div className="py-12 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-muted text-foreground flex items-center justify-center mx-auto">
        <Check className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        Pomyślnie zaimportowano {importCount} podopiecznych!
      </h3>
      {capacityUpdated?.updated && (
        <p className="text-sm text-foreground font-medium bg-muted p-2 rounded border border-border inline-block">
          Limit miejsc placówki wynosi{' '}
          <strong>{capacityUpdated.newCapacity}</strong>.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Dane zostały zabezpieczone, a lista placówki została zaktualizowana.
      </p>
    </div>
  )
}
