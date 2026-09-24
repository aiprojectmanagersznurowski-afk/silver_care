import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AddResidentDialog } from '@/components/AddResidentDialog'
import { AdmissionWizard } from '@/components/AdmissionWizard'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ExportDataDialog } from '@/components/ExportDataDialog'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { ResidentMobileCard } from '@/components/ResidentMobileCard'
import Link from 'next/link'
import { type CareLevel } from '@/lib/reporting-constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

interface BedAssignmentItem {
  id: string
  unassigned_at: string | null
  beds: {
    id: string
    label: string
    rooms: {
      number: string
    } | null
  } | null
}

interface ResidentWithAssignments {
  id: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  care_level?: CareLevel | null
  is_zsn?: boolean
  archived_at?: string | null
  death_date?: string | null
  admission_date?: string | null
  created_at: string
  bed_assignments?: BedAssignmentItem[]
}

export default async function AdminResidentsPage() {
  const supabase = await createClient()

  // Pobieramy wszystkich pensjonariuszy z organizacji tego admina
  const { data: rawResidents } = await supabase
    .from('residents')
    .select('*, bed_assignments(id, unassigned_at, beds(id, label, rooms(number)))')
    .order('created_at', { ascending: false })

  const residents = rawResidents as unknown as ResidentWithAssignments[] | null

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Podopieczni
          </h2>
          <p className="mt-2 text-slate-soft">Zarządzaj bazą podopiecznych w swojej placówce.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <ExportDataDialog />
          <BulkImportDialog />
          <AdmissionWizard />
          <AddResidentDialog />
        </div>
      </div>

      {/* Widok mobilny — lista kart (< sm) */}
      <div className="block sm:hidden space-y-3">
        {residents?.map((resident) => (
          <ResidentMobileCard key={resident.id} resident={resident} />
        ))}
        {(!residents || residents.length === 0) && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-soft ring-1 ring-slate/5">
            Brak podopiecznych w bazie. Kliknij przycisk powyżej, aby dodać pierwszą osobę.
          </div>
        )}
      </div>

      {/* Widok desktopowy — pełna tabela (>= sm) */}
      <Card className="hidden sm:block rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
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
                  <th className="px-6 py-4 font-medium w-24 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {residents?.map((resident) => {
                  const activeAssignments = Array.isArray(resident.bed_assignments)
                    ? resident.bed_assignments.filter((a) => a.unassigned_at === null)
                    : []
                  const activeBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null

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
                        <ResidentInlineCareLevel
                          residentId={resident.id}
                          initialCareLevel={resident.care_level ?? null}
                        />
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ResidentEditSheet resident={resident} />
                          <Link
                            href={`/admin/residents/${resident.id}`}
                            className="p-2 text-slate-soft/50 hover:text-sage transition-colors min-h-[48px] min-w-[48px] inline-flex items-center justify-center"
                            title="Profil 360°"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </div>
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
