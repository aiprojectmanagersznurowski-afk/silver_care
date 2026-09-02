import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AddResidentDialog } from '@/components/AddResidentDialog'
import { AdminMessagesInbox } from '@/components/AdminMessagesInbox'
import { deleteResidentAction } from '@/actions/admin'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
            Pensjonariusze i Komunikacja
          </h2>
          <p className="text-text-secondary">Zarządzaj bazą podopiecznych i odbieraj wiadomości od rodzin.</p>
        </div>
        <AddResidentDialog />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                      <th className="h-12 px-4 text-right align-middle font-medium text-text-secondary">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {residents?.map((resident) => (
                      <tr key={resident.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {resident.avatar_url && (
                                <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                              )}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {resident.first_name?.charAt(0)}{resident.last_name?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{resident.first_name} {resident.last_name}</span>
                          </div>
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
                        <td className="p-4 align-middle text-right">
                          <form action={deleteResidentAction}>
                            <input type="hidden" name="id" value={resident.id} />
                            <Button variant="ghost" size="icon" type="submit" title="Usuń pensjonariusza i zwolnij łóżko" className="text-destructive hover:bg-destructive/10 h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {(!residents || residents.length === 0) && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-text-secondary">
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

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <AdminMessagesInbox />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
