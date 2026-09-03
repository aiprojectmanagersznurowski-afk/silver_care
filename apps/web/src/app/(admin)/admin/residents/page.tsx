import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AddResidentDialog } from '@/components/AddResidentDialog'
import { ManageResidentBedDialog } from '@/components/ManageResidentBedDialog'
import { deleteResidentAction } from '@/actions/admin'
import { Trash2, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default async function AdminResidentsPage() {
  const supabase = await createClient()

  // Pobieramy wszystkich pensjonariuszy z organizacji tego admina
  const { data: residents } = await supabase
    .from('residents')
    .select('*, bed_assignments(id, unassigned_at, beds(id, label, rooms(number)))')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Podopieczni
          </h2>
          <p className="mt-2 text-slate-soft">Zarządzaj bazą podopiecznych w swojej placówce.</p>
        </div>
        <AddResidentDialog />
      </div>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th className="px-6 py-4 font-medium">Imię i nazwisko</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Utworzono</th>
                  <th className="px-6 py-4 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {residents?.map((resident) => (
                  <tr key={resident.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate/10">
                          {resident.avatar_url && (
                            <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                          )}
                          <AvatarFallback className="bg-sage/10 text-sage">
                            <UserCircle2 className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-slate text-base">{resident.first_name} {resident.last_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {resident.archived_at ? (
                        <span className="inline-flex items-center rounded-md bg-slate/10 px-2.5 py-1 text-xs font-medium text-slate-soft">
                          Zarchiwizowany
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Aktywny
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {new Date(resident.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 items-center">
                        {(() => {
                          const activeAssignments = Array.isArray(resident.bed_assignments)
                            ? resident.bed_assignments.filter((a: any) => a.unassigned_at === null)
                            : []
                          const activeBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null
                          
                          return (
                            <ManageResidentBedDialog 
                              residentId={resident.id}
                              currentBedLabel={activeBed?.label}
                              currentRoomNumber={activeBed?.rooms?.number}
                            />
                          )
                        })()}
                        <form action={deleteResidentAction}>
                          <input type="hidden" name="id" value={resident.id} />
                          <Button variant="ghost" size="icon" type="submit" title="Usuń pensjonariusza i zwolnij łóżko" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9 rounded-xl">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!residents || residents.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-soft">
                      Brak podopiecznych w bazie. Kliknij przycisk powyżej, aby dodać pierwszą osobę.
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
