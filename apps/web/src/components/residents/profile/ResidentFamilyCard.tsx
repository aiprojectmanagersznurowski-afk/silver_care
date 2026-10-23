'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck } from 'lucide-react'
import { InviteFamilyDialog } from '@/components/InviteFamilyDialog'
import { PrimaryContactButton } from '@/components/PrimaryContactButton'
import { FullResidentData, ResidentRelativeLinkItem } from './profile-types'

interface ResidentFamilyCardProps {
  resident: FullResidentData
  relativeLinks: ResidentRelativeLinkItem[]
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
}: ResidentFamilyCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Bliscy i kontakty ({relativeLinks.length})
        </CardTitle>
        <InviteFamilyDialog
          residents={[{ id: resident.id, first_name: resident.first_name, last_name: resident.last_name }]}
          defaultResidentId={resident.id}
          triggerLabel="Zaproś bliskiego"
        />
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {relativeLinks.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            Brak powiązanych kont bliskich. Użyj przycisku &bdquo;Zaproś bliskiego&rdquo;, aby nadać dostęp do portalu rodziny.
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
