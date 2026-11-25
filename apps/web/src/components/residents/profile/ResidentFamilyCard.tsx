'use client'

import React, { useActionState } from 'react'
import { CONSENT_PURPOSES } from '@silvercare/contracts/src/generated/roles'
import { recordResidentConsent } from '@/actions/resident-consent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck } from 'lucide-react'
import { InviteFamilyDialog } from '@/components/InviteFamilyDialog'
import { PrimaryContactButton } from '@/components/PrimaryContactButton'
import { FullResidentData, ResidentRelativeLinkItem } from './profile-types'

interface ResidentFamilyCardProps {
  resident: FullResidentData
  relativeLinks: ResidentRelativeLinkItem[]
  canInvite: boolean
}

const RELATION_LABELS: Record<string, string> = {
  daughter: 'Córka',
  son: 'Syn',
  spouse: 'Współmałżonek',
  legal_guardian: 'Opiekun prawny',
  other_relative: 'Inny krewny',
  friend: 'Przyjaciel / zaufana osoba',
}

export function ResidentFamilyCard({
  resident,
  relativeLinks,
  canInvite,
}: ResidentFamilyCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Bliscy i kontakty ({relativeLinks.length})
        </CardTitle>
        {canInvite && (
          <InviteFamilyDialog
            residents={[{ id: resident.id, first_name: resident.first_name, last_name: resident.last_name }]}
            defaultResidentId={resident.id}
            triggerLabel="Zaproś bliskiego"
          />
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <ConsentRecorder residentId={resident.id} guardians={relativeLinks.filter((link) => link.role === 'legal_guardian')} />
        {relativeLinks.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            Brak powiązanych kont bliskich.
          </div>
        ) : (
          <div className="space-y-2.5">
            {relativeLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {RELATION_LABELS[link.relationship_code] || link.relationship_code}
                    </span>
                    {link.is_primary_contact && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <UserCheck className="h-3 w-3" />
                        Główny kontakt
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Rola systemowa: {link.role} · Od: {link.created_at?.substring(0, 10)}
                  </span>
                </div>

                <PrimaryContactButton
                  linkId={link.id}
                  residentId={resident.id}
                  isPrimary={Boolean(link.is_primary_contact)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


const CONSENT_LABELS = {
  wellness_data_ingest: 'Pobieranie danych z opaski',
  family_report_access: 'Udostępnianie raportów bliskim',
  wellness_family_view: 'Udostępnianie aktywności i snu bliskim',
}

function ConsentRecorder({ residentId, guardians }: { residentId: string; guardians: ResidentRelativeLinkItem[] }) {
  const [result, record, pending] = useActionState(recordResidentConsent, { message: '', saved: false })
  const selectClass = 'min-h-touch w-full rounded-md border border-input bg-background px-2 text-sm'
  return (
    <details className="rounded-lg border border-border px-3">
      <summary className="min-h-touch cursor-pointer py-2 text-sm font-medium">Zarejestruj udokumentowaną zgodę</summary>
      <form action={record} className="grid gap-3 pb-3 text-sm">
        <input type="hidden" name="resident" value={residentId} />
        <label className="grid gap-1">
          Cel zgody
          <select name="purpose" className={selectClass} required defaultValue="">
            <option value="" disabled>Wybierz cel</option>
            {CONSENT_PURPOSES.map(({ id }) => <option key={id} value={id}>{CONSENT_LABELS[id]}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          Kto wyraził zgodę
          <select name="grantor" className={selectClass} required defaultValue="">
            <option value="" disabled>Wybierz osobę</option>
            <option value="resident_self">Podopieczny</option>
            {guardians.map((guardian) => (
              <option key={guardian.id} value={guardian.relative_user_id}>
                Opiekun prawny ({guardian.created_at.slice(0, 10)}, {guardian.relative_user_id.slice(-6)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-touch items-center gap-2">
          <input type="checkbox" name="confirmed" required />
          Mam udokumentowaną zgodę na wybrany cel.
        </label>
        <div><Button type="submit" disabled={pending}>Zapisz zgodę</Button></div>
        {result.message && <p role={result.saved ? 'status' : 'alert'}>{result.message}</p>}
      </form>
    </details>
  )
}
