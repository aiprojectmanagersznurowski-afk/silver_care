import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Check, AlertTriangle } from 'lucide-react'
import type { ValidatedResidentRow } from '@/lib/bulk-import-helpers'

export function BulkImportPreviewTable({
  rows,
}: {
  rows: ValidatedResidentRow[]
}) {
  return (
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
          {rows.map((r) => (
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
  )
}
