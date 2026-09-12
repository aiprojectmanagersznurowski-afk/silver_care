import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  UserCircle2, Calendar, Heart, BedDouble, Users, FileText,
  Clock, ArrowLeft, MapPin
} from 'lucide-react'
import Link from 'next/link'
import {
  CARE_LEVEL_LABELS, CARE_LEVEL_COLORS,
  CONTRACT_SOURCE_LABELS, CONTRACT_END_REASON_LABELS,
  EVENT_TYPE_LABELS, EVENT_TYPE_ICONS,
  PACKAGE_TYPE_LABELS, GENDER_LABELS,
  type CareLevel, type ContractSource, type ContractEndReason,
  type EventType, type PackageType,
} from '@/lib/reporting-constants'
import { differenceInYears, differenceInDays, format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default async function ResidentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch resident with all relations
  const { data: resident, error } = await supabase
    .from('residents')
    .select(`
      *,
      bed_assignments(id, assigned_at, unassigned_at, beds(id, label, rooms(number, floor, sector))),
      resident_relative_links(id, relative_user_id, relationship_code, role, created_at),
      resident_events(id, event_type, event_date, event_reason, metadata, created_at),
      resident_packages(id, package_type, package_name, monthly_rate, started_at, ended_at)
    `)
    .eq('id', id)
    .single()

  if (error || !resident) {
    notFound()
  }

  const age = resident.birth_date
    ? differenceInYears(new Date(), new Date(resident.birth_date))
    : null

  const stayDays = resident.admission_date
    ? differenceInDays(new Date(), new Date(resident.admission_date))
    : null

  const isActive = !resident.archived_at && !resident.death_date &&
    (!resident.contract_end_date || new Date(resident.contract_end_date) > new Date())

  const activeAssignment = Array.isArray(resident.bed_assignments)
    ? resident.bed_assignments.find((a: any) => a.unassigned_at === null)
    : null

  const sortedEvents = Array.isArray(resident.resident_events)
    ? [...resident.resident_events].sort(
        (a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      )
    : []

  const activePackages = Array.isArray(resident.resident_packages)
    ? resident.resident_packages.filter((p: any) => !p.ended_at)
    : []

  const pastAssignments = Array.isArray(resident.bed_assignments)
    ? resident.bed_assignments
        .filter((a: any) => a.unassigned_at !== null)
        .sort((a: any, b: any) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
    : []

  const careLevel = (resident.care_level || 'unknown') as CareLevel | 'unknown'
  const careLevelColor = CARE_LEVEL_COLORS[careLevel]

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/admin/residents"
        className="inline-flex items-center gap-2 text-sm text-slate-soft hover:text-slate transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Powrót do listy podopiecznych
      </Link>

      {/* Header Card */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <div className="relative">
          {/* Gradient banner */}
          <div className="h-32 bg-gradient-to-r from-sage/20 via-sage/10 to-transparent" />

          <CardContent className="relative -mt-16 px-8 pb-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                {resident.avatar_url && (
                  <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                )}
                <AvatarFallback className="bg-sage/10 text-sage text-2xl">
                  <UserCircle2 className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 pt-4 sm:pt-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-display font-semibold text-slate">
                    {resident.first_name} {resident.last_name}
                  </h1>
                  {isActive ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Aktywny
                    </Badge>
                  ) : resident.death_date ? (
                    <Badge className="bg-slate/10 text-slate-soft border-slate/20">
                      Zgon
                    </Badge>
                  ) : (
                    <Badge className="bg-slate/10 text-slate-soft border-slate/20">
                      Zarchiwizowany
                    </Badge>
                  )}
                  {resident.care_level && (
                    <Badge
                      style={{ backgroundColor: `${careLevelColor}20`, color: careLevelColor, borderColor: `${careLevelColor}40` }}
                      className="border"
                    >
                      {CARE_LEVEL_LABELS[careLevel]}
                    </Badge>
                  )}
                </div>

                {/* Quick stats row */}
                <div className="mt-3 flex flex-wrap gap-6 text-sm text-slate-soft">
                  {age !== null && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {age} lat
                    </span>
                  )}
                  {stayDays !== null && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Pobyt: {stayDays} dni
                    </span>
                  )}
                  {activeAssignment && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Pokój {activeAssignment.beds?.rooms?.number}, łóżko {activeAssignment.beds?.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Personal data + Contract */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal data */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <UserCircle2 className="h-5 w-5 text-sage" /> Dane osobowe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DataField label="Imię" value={resident.first_name} />
                <DataField label="Nazwisko" value={resident.last_name} />
                <DataField
                  label="Data urodzenia"
                  value={resident.birth_date
                    ? `${format(new Date(resident.birth_date), 'd MMMM yyyy', { locale: pl })} (${age} lat)`
                    : null}
                />
                <DataField
                  label="Płeć"
                  value={resident.gender ? GENDER_LABELS[resident.gender] : null}
                />
                <DataField
                  label="PESEL"
                  value={resident.pesel_hash ? '••••••••••• (zhashowany)' : null}
                />
                <DataField
                  label="Data przyjęcia"
                  value={resident.admission_date
                    ? format(new Date(resident.admission_date), 'd MMMM yyyy', { locale: pl })
                    : null}
                />
                {resident.death_date && (
                  <DataField
                    label="Data zgonu"
                    value={format(new Date(resident.death_date), 'd MMMM yyyy', { locale: pl })}
                  />
                )}
                {resident.notes && (
                  <div className="sm:col-span-2">
                    <DataField label="Notatki" value={resident.notes} />
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Contract */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <FileText className="h-5 w-5 text-sage" /> Umowa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DataField
                  label="Data podpisania"
                  value={resident.contract_start_date
                    ? format(new Date(resident.contract_start_date), 'd MMMM yyyy', { locale: pl })
                    : null}
                />
                <DataField
                  label="Data zakończenia"
                  value={resident.contract_end_date
                    ? format(new Date(resident.contract_end_date), 'd MMMM yyyy', { locale: pl })
                    : 'Aktywna'}
                />
                <DataField
                  label="Powód zakończenia"
                  value={resident.contract_end_reason
                    ? CONTRACT_END_REASON_LABELS[resident.contract_end_reason as ContractEndReason | 'Nieznany'] || resident.contract_end_reason
                    : null}
                />
                <DataField
                  label="Źródło"
                  value={resident.contract_source
                    ? CONTRACT_SOURCE_LABELS[resident.contract_source as ContractSource] || resident.contract_source
                    : null}
                />
                <DataField
                  label="Stawka miesięczna"
                  value={resident.contract_monthly_rate != null
                    ? `${Number(resident.contract_monthly_rate).toLocaleString('pl-PL')} zł`
                    : null}
                />
              </dl>
            </CardContent>
          </Card>

          {/* Event timeline */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <Clock className="h-5 w-5 text-sage" /> Oś czasu zdarzeń
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-slate-soft py-4 text-center">Brak zarejestrowanych zdarzeń.</p>
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-5 top-2 bottom-2 w-px bg-slate/10" />

                  {sortedEvents.map((event: any, index: number) => (
                    <div key={event.id} className="relative flex gap-4 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate/10 text-lg z-10">
                        {EVENT_TYPE_ICONS[event.event_type as EventType] || '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate">
                          {EVENT_TYPE_LABELS[event.event_type as EventType] || event.event_type}
                        </p>
                        {event.event_reason && (
                          <p className="text-xs text-slate-soft mt-0.5">
                            {CONTRACT_END_REASON_LABELS[event.event_reason as ContractEndReason | 'Nieznany'] || event.event_reason}
                          </p>
                        )}
                        <p className="text-xs text-slate-soft/60 mt-0.5">
                          {format(new Date(event.event_date), 'd MMMM yyyy', { locale: pl })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Room, Relatives, Packages */}
        <div className="space-y-6">
          {/* Current room */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <BedDouble className="h-5 w-5 text-sage" /> Pokój i łóżko
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeAssignment ? (
                <div className="rounded-xl bg-sage/5 p-4">
                  <p className="font-medium text-slate">
                    Pokój {activeAssignment.beds?.rooms?.number}
                  </p>
                  <p className="text-sm text-slate-soft">
                    Łóżko: {activeAssignment.beds?.label}
                  </p>
                  {activeAssignment.beds?.rooms?.floor && (
                    <p className="text-sm text-slate-soft">
                      Piętro: {activeAssignment.beds.rooms.floor}
                    </p>
                  )}
                  {activeAssignment.beds?.rooms?.sector && (
                    <p className="text-sm text-slate-soft">
                      Sektor: {activeAssignment.beds.rooms.sector}
                    </p>
                  )}
                  <p className="text-xs text-slate-soft/60 mt-2">
                    Od: {format(new Date(activeAssignment.assigned_at), 'd MMM yyyy', { locale: pl })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-soft text-center py-4">
                  Brak aktywnego przypisania do łóżka.
                </p>
              )}

              {pastAssignments.length > 0 && (
                <>
                  <p className="text-xs font-medium text-slate-soft uppercase tracking-wider">Historia</p>
                  <div className="space-y-2">
                    {pastAssignments.slice(0, 5).map((a: any) => (
                      <div key={a.id} className="text-sm text-slate-soft flex justify-between">
                        <span>
                          Pokój {a.beds?.rooms?.number}, łóżko {a.beds?.label}
                        </span>
                        <span className="text-xs">
                          {format(new Date(a.assigned_at), 'd.MM.yy', { locale: pl })} – {format(new Date(a.unassigned_at), 'd.MM.yy', { locale: pl })}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Relatives */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <Users className="h-5 w-5 text-sage" /> Bliscy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!resident.resident_relative_links || resident.resident_relative_links.length === 0) ? (
                <p className="text-sm text-slate-soft text-center py-4">
                  Brak powiązanych bliskich.
                </p>
              ) : (
                <div className="space-y-3">
                  {resident.resident_relative_links.map((link: any) => (
                    <div key={link.id} className="flex items-center justify-between rounded-xl bg-slate/5 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate">
                          {link.relationship_code}
                        </p>
                        <p className="text-xs text-slate-soft">
                          {link.role === 'legal_guardian' ? 'Opiekun prawny' : 'Rodzina'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {link.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Packages */}
          <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate">
                <Heart className="h-5 w-5 text-sage" /> Pakiety
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activePackages.length === 0 ? (
                <p className="text-sm text-slate-soft text-center py-4">
                  Brak aktywnych pakietów.
                </p>
              ) : (
                <div className="space-y-2">
                  {activePackages.map((pkg: any) => (
                    <div key={pkg.id} className="flex items-center justify-between rounded-xl bg-sage/5 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate">{pkg.package_name}</p>
                        <p className="text-xs text-slate-soft">
                          {PACKAGE_TYPE_LABELS[pkg.package_type as PackageType] || pkg.package_type}
                        </p>
                      </div>
                      {pkg.monthly_rate && (
                        <span className="text-sm font-medium text-slate">
                          {Number(pkg.monthly_rate).toLocaleString('pl-PL')} zł
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Helper component for data fields
function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="font-medium text-slate-soft">{label}</dt>
      <dd className="mt-1 text-slate">{value || <span className="text-slate-soft/50">—</span>}</dd>
    </div>
  )
}
