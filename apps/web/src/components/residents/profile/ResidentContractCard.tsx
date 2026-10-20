'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, ShieldCheck } from 'lucide-react'
import {
  CONTRACT_SOURCE_LABELS,
  PACKAGE_TYPE_LABELS,
  ContractSource,
  PackageType,
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
  const contractSource = (resident.contract_source || 'private') as ContractSource

  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Umowa i pakiety opiekuńcze
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted-foreground block">Źródło finansowania</span>
            <span className="text-sm font-medium text-foreground">
              {CONTRACT_SOURCE_LABELS[contractSource] || contractSource}
            </span>
          </div>

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
