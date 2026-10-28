import { PageHeader } from '@/components/patterns/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getBedOptimizerRulesAction } from '@/actions/bed-rules'
import { BedRulesSettingsForm } from '@/components/facility/BedRulesSettingsForm'

export const dynamic = 'force-dynamic'

export default async function FacilitySettingsPage() {
  const initialRules = await getBedOptimizerRulesAction()

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
          <CardContent>
            <BedRulesSettingsForm initialRules={initialRules} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
