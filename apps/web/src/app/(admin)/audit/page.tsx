import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function AdminAuditPage() {
  const supabase = await createClient()

  // Pobieranie audytu. Pamiętaj, że dla uproszczenia MVP czytamy z tabeli `audit_logs` (jeśli zdefiniowaliśmy ją w migracji).
  // Zakładam, że RLS filtruje po organization_id (zależnie od kontraktu).
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50) // Paginacja na MVP nie jest konieczna, pokazujemy 50 ostatnich.

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Rejestr Audytowy
        </h2>
        <p className="text-text-secondary">Wgląd w logi bezpieczeństwa i akcji systemowych (Tylko do odczytu).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ostatnie zdarzenia</CardTitle>
          <CardDescription>Historia operacji z ostatnich dni (limit: 50).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Czas</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Akcja</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Tabela</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">User ID</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {logs?.map((log) => (
                  <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle text-text-secondary">
                      {new Date(log.created_at).toLocaleString('pl-PL')}
                    </td>
                    <td className="p-4 align-middle font-medium">
                      {log.action}
                    </td>
                    <td className="p-4 align-middle font-mono text-xs text-text-tertiary">
                      {log.table_name}
                    </td>
                    <td className="p-4 align-middle font-mono text-xs">
                      {log.actor_id}
                    </td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-text-secondary">
                      Brak wpisów w rejestrze audytowym.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
