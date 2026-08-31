import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Pobieramy wszystkich pensjonariuszy z organizacji tego admina
  const { data: residents } = await supabase
    .from('residents')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Pensjonariusze
          </h2>
          <p className="text-text-secondary">Zarządzaj bazą podopiecznych w swojej placówce.</p>
        </div>
        <Button>Dodaj pensjonariusza</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista podopiecznych</CardTitle>
          <CardDescription>Ostatnio dodani lub zmodyfikowani</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Imię i nazwisko</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Utworzono</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {residents?.map((resident) => (
                  <tr key={resident.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle">
                      {resident.first_name} {resident.last_name}
                    </td>
                    <td className="p-4 align-middle">
                      {resident.archived_at ? (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                          Zarchiwizowany
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-primary text-primary-foreground">
                          Aktywny
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-text-secondary">
                      {new Date(resident.created_at).toLocaleDateString('pl-PL')}
                    </td>
                  </tr>
                ))}
                {(!residents || residents.length === 0) && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-text-secondary">
                      Brak pensjonariuszy w bazie.
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
