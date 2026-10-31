'use client'

import React, { useState, useTransition } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  type BedOptimizerRulesConfig,
} from '@/lib/bed-allocation-optimizer'
import { saveBedOptimizerRulesAction } from '@/actions/bed-rules'

interface BedRulesSettingsFormProps {
  initialRules: BedOptimizerRulesConfig
}

export function BedRulesSettingsForm({ initialRules }: BedRulesSettingsFormProps) {
  const [rules, setRules] = useState<BedOptimizerRulesConfig>(initialRules)
  const [isPending, startTransition] = useTransition()

  const handleToggle = (key: keyof BedOptimizerRulesConfig, value: boolean) => {
    const updated = { ...rules, [key]: value }
    setRules(updated)
    startTransition(async () => {
      const res = await saveBedOptimizerRulesAction(updated)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Zapisano ustawienia reguł przydziału łóżek.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label
            id="enforce-gender-label"
            className="text-sm font-medium cursor-pointer"
            onClick={() => handleToggle('enforceGenderSeparation', !rules.enforceGenderSeparation)}
          >
            Wymuszaj zgodność płciową w pokojach wieloosobowych
          </Label>
          <p className="text-xs text-muted-foreground">
            Proponuje zamiany eliminujące koedukacyjne zakwaterowanie w pokojach wieloosobowych.
          </p>
        </div>
        <Switch
          aria-labelledby="enforce-gender-label"
          checked={rules.enforceGenderSeparation}
          disabled={isPending}
          onCheckedChange={(checked) => handleToggle('enforceGenderSeparation', checked)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div className="space-y-1">
          <Label
            id="prefer-ground-label"
            className="text-sm font-medium cursor-pointer"
            onClick={() =>
              handleToggle('preferGroundFloorForReducedMobility', !rules.preferGroundFloorForReducedMobility)
            }
          >
            Preferuj parter dla osób leżących i ZSN
          </Label>
          <p className="text-xs text-muted-foreground">
            Sugeruje przeniesienie podopiecznych z ograniczoną mobilnością i ZSN na parter.
          </p>
        </div>
        <Switch
          aria-labelledby="prefer-ground-label"
          checked={rules.preferGroundFloorForReducedMobility}
          disabled={isPending}
          onCheckedChange={(checked) =>
            handleToggle('preferGroundFloorForReducedMobility', checked)
          }
        />
      </div>
    </div>
  )
}
