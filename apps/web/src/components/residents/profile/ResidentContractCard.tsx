'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { updateResidentFundingAction } from '@/actions/resident-funding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ShieldCheck } from 'lucide-react'
import {
  PACKAGE_TYPE_LABELS,
  PackageType,
  contractSourceLabel,
  fundingSourceLabel,
  FUNDING_SOURCES,
  FUNDING_SOURCE_LABELS,
} from '@/lib/reporting-constants'
import { ResidentContractAttachment } from '@/components/facility/ResidentContractAttachment'
import { FullResidentData, ResidentPackageItem } from './profile-types'

interface ResidentContractCardProps {
  resident: FullResidentData
  activePackages: ResidentPackageItem[]
  /** Kierownik placówki poza trybem tylko do odczytu (sekcja „manage” karty). */
  canEdit?: boolean
}

export function ResidentContractCard({
  resident,
  activePackages,
  canEdit = false,
}: ResidentContractCardProps) {
  // Brak wartości = „Brak danych” (zakaz fabrykowania w fallbackach)
  const funding = Array.isArray(resident.resident_funding) ? resident.resident_funding[0] : resident.resident_funding

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Umowa i pakiety opiekuńcze
        </CardTitle>
      </CardHeader>
      {/* @container: karta stoi w wąskim pasku bocznym na laptopie i w pełnej szerokości na telefonie */}
      <CardContent className="@container pt-4 space-y-4">
        <div className="grid grid-cols-1 @xs:grid-cols-2 gap-4">
          <FundingField residentId={resident.id} code={funding?.funding_source ?? null} canEdit={canEdit} />
          <ContractField testId="contract-source" label="Źródło pozyskania" value={contractSourceLabel(resident.contract_source)} />

          <div>
            <span className="text-sm text-muted-foreground block">Aktywny pakiet</span>
            <span className="text-sm font-medium text-foreground">
              {activePackages.length > 0
                ? activePackages.map((p) => p.package_name || PACKAGE_TYPE_LABELS[p.package_type as PackageType] || p.package_type).join(', ')
                : 'Podstawowy pobyt placówki'}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60">
          <span className="text-sm font-semibold text-muted-foreground block mb-2">
            Dokumentacja i załącznik umowy
          </span>
          <ResidentContractAttachment
            residentId={resident.id}
            initialContractPath={resident.contract_document_url || null}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ContractField({ testId, label, value }: { testId: string; label: string; value: string }) {
  return (
    <div data-testid={testId}>
      <span data-slot="field-label" className="text-sm text-muted-foreground block">{label}</span>
      <span data-slot="field-value" className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

/** Źródło finansowania z edycją dla kierownika (SC-ADM-24); bez wartości domyślnej przy wyborze. */
function FundingField({ residentId, code, canEdit }: { residentId: string; code: string | null; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(code ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const res = await updateResidentFundingAction(residentId, value)
      if (!res.success) return setError(res.error ?? 'Nie udało się zapisać źródła finansowania.')
      setError(null)
      setEditing(false)
      router.refresh()
    })

  if (!editing) {
    return (
      <div data-testid="funding-source">
        <span data-slot="field-label" className="text-sm text-muted-foreground block">Źródło finansowania</span>
        <div className="flex items-center gap-2">
          <span data-slot="field-value" className="text-sm font-medium text-foreground">{fundingSourceLabel(code)}</span>
          {canEdit && (
            <Button variant="ghost" size="sm" className="min-h-touch" aria-label="Zmień źródło finansowania" onClick={() => setEditing(true)}>
              Zmień
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="funding-source" className="@xs:col-span-2 space-y-2">
      <label htmlFor={`funding-${residentId}`} data-slot="field-label" className="text-sm text-muted-foreground block">Źródło finansowania</label>
      <NativeSelect id={`funding-${residentId}`} value={value} onChange={(e) => setValue(e.target.value)} disabled={isPending} className="w-full">
        <NativeSelectOption value="" disabled>Wybierz źródło finansowania</NativeSelectOption>
        {FUNDING_SOURCES.map((key) => (
          <NativeSelectOption key={key} value={key}>{FUNDING_SOURCE_LABELS[key]}</NativeSelectOption>
        ))}
      </NativeSelect>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" className="min-h-touch" disabled={isPending} onClick={() => { setEditing(false); setValue(code ?? ''); setError(null) }}>
          Anuluj
        </Button>
        <Button size="sm" className="min-h-touch" disabled={isPending || !value} onClick={save}>
          Zapisz
        </Button>
      </div>
    </div>
  )
}
