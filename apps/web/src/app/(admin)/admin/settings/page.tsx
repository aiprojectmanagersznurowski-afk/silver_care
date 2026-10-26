'use client'

import { useEffect, useState, useTransition } from 'react'
import { PageHeader } from '@/components/patterns/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  DEFAULT_BED_OPTIMIZER_RULES,
  type BedOptimizerRulesConfig,
} from '@/lib/bed-allocation-optimizer'
import {
  getBedOptimizerRulesAction,
  saveBedOptimizerRulesAction,
} from '@/actions/bed-rules'

export default function FacilitySettingsPage() {
  const [rules, setRules] = useState<BedOptimizerRulesConfig>(DEFAULT_BED_OPTIMIZER_RULES)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    getBedOptimizerRulesAction()
      .then((loaded) => {
        if (active) {
          setRules(loaded)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
    <div className="space-y-8">
      <PageHeader
        title="Ustawienia placówki"
        description="Konfiguracja parametrów i reguł operacyjnych placówki."
      />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Reguły przydziału łóżek</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Określ kryteria brane pod uwagę przez asystenta przydziału łóżek przy analizie obłożenia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span
                  id="enforce-gender-label"
                  className="text-sm font-medium cursor-pointer"
                  onClick={() => handleToggle('enforceGenderSeparation', !rules.enforceGenderSeparation)}
                >
                  Wymuszaj zgodność płciową w pokojach wieloosobowych
                </span>
                <p className="text-xs text-muted-foreground">
                  Proponuje zamiany eliminujące koedukacyjne zakwaterowanie w pokojach wieloosobowych.
                </p>
              </div>
              <Switch
                aria-label="Wymuszaj zgodność płciową w pokojach wieloosobowych"
                checked={rules.enforceGenderSeparation}
                disabled={isLoading || isPending}
                onCheckedChange={(checked) => handleToggle('enforceGenderSeparation', checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div className="space-y-1">
                <span
                  id="prefer-ground-label"
                  className="text-sm font-medium cursor-pointer"
                  onClick={() =>
                    handleToggle('preferGroundFloorForReducedMobility', !rules.preferGroundFloorForReducedMobility)
                  }
                >
                  Preferuj parter dla osób leżących i ZSN
                </span>
                <p className="text-xs text-muted-foreground">
                  Sugeruje przeniesienie pensjonariuszy z ograniczoną mobilnością i ZSN na parter.
                </p>
              </div>
              <Switch
                aria-label="Preferuj parter dla osób leżących i ZSN"
                checked={rules.preferGroundFloorForReducedMobility}
                disabled={isLoading || isPending}
                onCheckedChange={(checked) =>
                  handleToggle('preferGroundFloorForReducedMobility', checked)
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
