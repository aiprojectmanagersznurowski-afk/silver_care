import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AddResidentDialog } from '@/components/AddResidentDialog'
import { AdmissionWizard } from '@/components/AdmissionWizard'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import Link from 'next/link'
import { CARE_LEVEL_LABELS, CARE_LEVEL_COLORS, type CareLevel } from '@/lib/reporting-constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

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
        <div className="flex items-center gap-3">
          <BulkImportDialog />
          <AdmissionWizard />
          <AddResidentDialog />
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th className="px-6 py-4 font-medium">Imię i nazwisko</th>
                  <th className="px-6 py-4 font-medium">Stan</th>
                  <th className="px-6 py-4 font-medium">ZSN</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Pokój</th>
                  <th className="px-6 py-4 font-medium">Data przyjęcia</th>
                  <th className="px-6 py-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {residents?.map((resident) => {
                  const activeAssignments = Array.isArray(resident.bed_assignments)
                    ? resident.bed_assignments.filter((a: any) => a.unassigned_at === null)
                    : []
                  const activeBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null
                  const careLevel = (resident.care_level || 'unknown') as CareLevel | 'unknown'

                  return (
                    <tr key={resident.id} className="transition-colors hover:bg-slate/5 group">
                      <td className="px-6 py-4">
                        <Link href={`/admin/residents/${resident.id}`} className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-slate/10">
                            {resident.avatar_url && (
                              <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                            )}
                            <AvatarFallback className="bg-sage/10 text-sage">
                              <UserCircle2 className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate text-base group-hover:text-sage transition-colors">
                            {resident.first_name} {resident.last_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {resident.care_level ? (
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: `${CARE_LEVEL_COLORS[careLevel]}15`,
                              color: CARE_LEVEL_COLORS[careLevel],
                              borderColor: `${CARE_LEVEL_COLORS[careLevel]}40`,
                            }}
                            className="text-xs"
                          >
                            {CARE_LEVEL_LABELS[careLevel]}
                          </Badge>
                        ) : (
                          <span className="text-slate-soft/50 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ResidentZsnCheckbox
                          residentId={resident.id}
                          initialValue={Boolean(resident.is_zsn)}
                          variant="compact"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {resident.archived_at ? (
                          <Badge className="bg-slate/10 text-slate-soft border-none text-xs">
                            Zarchiwizowany
                          </Badge>
                        ) : resident.death_date ? (
                          <Badge className="bg-slate/10 text-slate-soft border-none text-xs">
                            Zgon
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-none text-xs">
                            Aktywny
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-soft">
                        {activeBed ? (
                          <span>
                            Pok. {activeBed.rooms?.number}, ł. {activeBed.label}
                          </span>
                        ) : (
                          <span className="text-slate-soft/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-soft">
                        {resident.admission_date
                          ? format(new Date(resident.admission_date), 'd MMM yyyy', { locale: pl })
                          : resident.created_at
                            ? format(new Date(resident.created_at), 'd MMM yyyy', { locale: pl })
                            : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/residents/${resident.id}`}>
                          <ChevronRight className="h-5 w-5 text-slate-soft/30 group-hover:text-sage transition-colors" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {(!residents || residents.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-soft">
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
