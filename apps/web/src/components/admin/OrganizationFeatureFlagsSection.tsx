'use client'

import { useState, useTransition } from 'react'
import {
  FEATURE_FLAGS, FEATURE_FLAGS_BY_KEY, getAncestorFeatureKeys, getDependentFeatureKeys,
  type FeatureKey, type FeatureFlagKind,
} from '@silvercare/contracts/src/generated/features'
import { toggleOrganizationFeatureFlagAction } from '@/actions/organization-feature-flags'
import type { EffectiveFeatureFlags } from '@/lib/feature-flags'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { ListError } from '@/components/patterns/ListState'
import { FeatureFlagsMfa } from './FeatureFlagsMfa'
import { useRouter } from 'next/navigation'

const sections = [
  { title: 'Moduły placówki', kind: 'module' },
  { title: 'Delegacja uprawnień dla Kierownika placówki', kind: 'delegation' },
] satisfies { title: string; kind: FeatureFlagKind }[]

interface Props {
  organizationId: string
  flags: EffectiveFeatureFlags | null
  isImpersonating: boolean
  hasMfa: boolean
  needsMfaVerification: boolean
}

export function OrganizationFeatureFlagsSection({ organizationId, flags, isImpersonating, hasMfa, needsMfaVerification }: Props) {
  const [pending, startTransition] = useTransition()
  const [confirmation, setConfirmation] = useState<FeatureKey | null>(null)
  const [error, setError] = useState<string>()
  const router = useRouter()
  const blocked = isImpersonating || !hasMfa
  const activeDependents = (key: FeatureKey) => getDependentFeatureKeys(key).filter((child) => flags?.[child])

  function submit(featureKey: FeatureKey, enabled: boolean) {
    setError(undefined)
    startTransition(async () => {
      try {
        const result = await toggleOrganizationFeatureFlagAction({ organizationId, featureKey, enabled })
        if (!result.ok) setError(result.error)
      } catch {
        setError('Nie udało się zapisać ustawienia modułu.')
      }
    })
  }

  return (
    <section className="space-y-4" aria-label="Ustawienia modułów placówki">
      {isImpersonating && <p role="status" className="rounded-lg border border-border p-4 text-sm">
        Tryb podglądu placówki blokuje zmianę modułów.
      </p>}
      {!isImpersonating && !hasMfa && <FeatureFlagsMfa needsVerification={needsMfaVerification} />}
      {error && <ListError title={error} />}
      {sections.map(({ title, kind }) => {
        const definitions = FEATURE_FLAGS.filter((flag) => flag.kind === kind)
        return (
          <TableCard title={title} key={kind}>
            <Table aria-label={title} aria-busy={pending}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Nazwa</TableHead>
                  <TableHead scope="col">Stan</TableHead>
                  <TableHead scope="col"><span className="sr-only">Zmień stan</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!flags ? <TableStateRow colSpan={3} state="error" action={
                  <Button type="button" className="min-h-touch" variant="outline" onClick={() => router.refresh()}>
                    Spróbuj ponownie
                  </Button>
                } /> : definitions.length === 0 ? <TableStateRow colSpan={3} state="empty" /> :
                  definitions.map(({ key, label, description }) => {
                    const inactive = getAncestorFeatureKeys(key).filter((ancestor) => !flags[ancestor])
                    return (
                      <TableRow key={key}>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                          {inactive.length > 0 && <div id={`requirements-${key}`} className="text-xs text-muted-foreground">
                            Wymaga włączenia: {inactive.map((ancestor) => FEATURE_FLAGS_BY_KEY[ancestor].label).join(', ')}
                          </div>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={flags[key] ? 'brand' : 'neutral'}>{flags[key] ? 'Włączony' : 'Wyłączony'}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <Switch aria-label={label} aria-describedby={inactive.length ? `requirements-${key}` : undefined}
                            className="min-h-touch min-w-touch" checked={flags[key]}
                            disabled={blocked || pending || inactive.length > 0}
                            onCheckedChange={(enabled) => {
                              if (!enabled && activeDependents(key).length) setConfirmation(key)
                              else submit(key, enabled)
                            }} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                {pending && <TableStateRow colSpan={3} state="loading" />}
              </TableBody>
            </Table>
          </TableCard>
        )
      })}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) setConfirmation(null) }}
        title="Wyłączyć moduł?"
        description={confirmation ? `Zostaną wyłączone również: ${activeDependents(confirmation)
          .map((key) => FEATURE_FLAGS_BY_KEY[key].label).join(', ')}.` : undefined}
        confirmLabel="Wyłącz moduł"
        onConfirm={() => { if (confirmation) submit(confirmation, false) }}
      />
    </section>
  )
}
