import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2, History, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { PageHeader } from '@/components/patterns/PageHeader'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { roleLabel } from '@/lib/auth/role-labels'
import { formatPersonName } from '@/lib/person-name'

const PURPOSE_LABELS: Record<string, { title: string; desc: string }> = {
  wellness_data_ingest: {
    title: 'Wskaźniki aktywności i snu z opaski',
    desc: 'Zbieranie i analiza dobowych kroków, czasu aktywności oraz długości snu pensjonariusza.',
  },
  family_view_basic: {
    title: 'Prezentacja raportów dobowych',
    desc: 'Udostępnianie zredagowanych przez personel podsumowań dnia w portalu bliskich.',
  },
  medical_records_access: {
    title: 'Dokumentacja opiekuńcza w placówce',
    desc: 'Dostęp personelu do notatek i procedur opiekuńczych na terenie ośrodka.',
  },
}

export default async function FamilyConsentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/')

  // Read linked residents
  const { data: links } = await supabase
    .from('resident_relative_links')
    .select('resident_id, role, relationship_code, residents(id, first_name, last_name)')
    .eq('relative_user_id', user.id)

  const residents = (links || []).map(link => 
    Array.isArray(link.residents) ? link.residents[0] : link.residents
  ).filter(Boolean) as { id: string; first_name: string; last_name: string }[]

  if (residents.length === 0) {
    return (
      <Card className="max-w-md mx-auto my-12 text-center">
        <CardContent className="py-12 space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-foreground">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Brak powiązanych podopiecznych</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Twoje konto nie ma jeszcze przypisanego podopiecznego w placówce.
          </p>
        </CardContent>
      </Card>
    )
  }

  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  const userRole = user.app_metadata?.role || links?.[0]?.role || 'family'
  const isLegalGuardian = userRole === 'legal_guardian'

  // Fetch consents for active resident
  const { data: consents } = await supabase
    .from('consent_ledger')
    .select('id, purpose, granted_by, granted_at, revoked_at')
    .eq('resident_id', activeResident.id)
    .order('granted_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-12">
      {/* Nagłówek sekcji */}
      <PageHeader
        title="Zgody i ochrona prywatności"
        description={<>Podopieczny: <span className="font-semibold text-foreground">{formatPersonName(activeResident.first_name, activeResident.last_name)}</span></>}
        actions={
          <>
            <StatusBadge tone="brand">
              <ShieldCheck />
              Art. 9 RODO & Rejestr Zgód
            </StatusBadge>
            <StatusBadge>Append-Only</StatusBadge>
            <div className="flex items-center gap-2 bg-muted/60 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground">
              <span>Rola konta:</span>
              <span className="font-semibold text-foreground">
                {roleLabel(isLegalGuardian ? 'legal_guardian' : 'family')}
              </span>
            </div>
          </>
        }
      />

      {/* Rola 'family' - komunikat edukacyjny o rozgraniczeniu uprawnień */}
      {!isLegalGuardian && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
              Uprawnienia roli: {roleLabel('family')}
            </CardTitle>
            <CardDescription className="text-sm sm:text-sm text-muted-foreground">
              Zgodnie z Art. 9 RODO oraz procedurami placówki, zgody na przetwarzanie danych szczególnych kategorii z urządzeń opiekuńczych może wyrażać wyłącznie Pensjonariusz lub ustanowiony Opiekun Prawny (<code className="font-mono text-sm">legal_guardian</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm sm:text-sm text-muted-foreground space-y-2">
            <p>
              Twoje konto posiada bezpieczny dostęp wglądu do publikowanych przez personel raportów dobowych oraz planu dnia.
              Jeśli jesteś formalnym opiekunem prawnym, skontaktuj się z administratorem placówki w celu aktualizacji statusu konta.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabela / Karty rejestru zgód */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary shrink-0" />
            Rejestr zdarzeń zgód (Consent Ledger)
          </CardTitle>
          <CardDescription className="text-sm sm:text-sm text-muted-foreground">
            Niezmienialny rejestr oświadczeń woli i celów przetwarzania danych w systemie Silver Care.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!consents || consents.length === 0) ? (
            <div className="text-center py-10 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">Brak wpisów w rejestrze zgód dla wybranego podopiecznego.</p>
              <p className="text-sm text-muted-foreground">Wszelkie oświadczenia woli rejestrowane są w momencie przyjęcia do placówki.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {consents.map((c) => {
                const isActive = !c.revoked_at
                const purposeInfo = PURPOSE_LABELS[c.purpose] || {
                  title: c.purpose,
                  desc: 'Przetwarzanie w ramach procedur opiekuńczych.',
                }

                return (
                  <div
                    key={c.id}
                    data-testid={`consent-row-${c.purpose}`}
                    className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{purposeInfo.title}</span>
                        {isActive ? (
                          <StatusBadge tone="brand">Aktywna</StatusBadge>
                        ) : (
                          <StatusBadge>Wycofana</StatusBadge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xl">{purposeInfo.desc}</p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-1">
                        <span>
                          Udzielono: <strong className="text-foreground">{format(new Date(c.granted_at), 'd MMMM yyyy, HH:mm', { locale: pl })}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Podmiot udzielający: <strong className="text-foreground">{c.granted_by === 'legal_guardian' ? roleLabel('legal_guardian') : 'Pensjonariusz'}</strong>
                        </span>
                        {c.revoked_at && (
                          <>
                            <span>•</span>
                            <span className="text-foreground">
                              Wycofano: {format(new Date(c.revoked_at), 'd MMMM yyyy, HH:mm', { locale: pl })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground font-mono shrink-0">
                      ID: {c.id.slice(0, 8)}…
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota prawna / MDR */}
      <div className="p-4 rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          Zasady rozliczalności i granica wyrobu medycznego (MDR)
        </p>
        <p>
          System Silver Care nie jest wyrobem medycznym ani systemem alarmowym. Zbierane dane z urządzeń ubieralnych służą wyłącznie do opisu codziennego samopoczucia i organizacji opieki. Rejestr zgód podlega rygorom niezmienialności (append-only) zgodnie z zasadą rozliczalności RODO.
        </p>
      </div>
    </div>
  )
}
