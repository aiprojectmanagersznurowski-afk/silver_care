'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ShieldCheck } from 'lucide-react'
import {
  PACKAGE_TYPE_LABELS,
  PackageType,
  contractSourceLabel,
  fundingSourceLabel,
} from '@/lib/reporting-constants'
import { ResidentContractAttachment } from '@/components/facility/ResidentContractAttachment'
import { FullResidentData, ResidentPackageItem } from './profile-types'

interface ResidentContractCardProps {
  resident: FullResidentData
  activePackages: ResidentPackageItem[]
}

export function ResidentContractCard({
  resident,
  activePackages,
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
          <ContractField testId="funding-source" label="Źródło finansowania" value={fundingSourceLabel(funding?.funding_source)} />
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
