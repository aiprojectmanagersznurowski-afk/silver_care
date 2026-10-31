import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Card } from '@/components/ui/card'
import { AdmissionWizard } from '@/components/AdmissionWizard'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ExportDataDialog } from '@/components/ExportDataDialog'
import { PageHeader, PageHeaderNotice } from '@/components/patterns/PageHeader'
import { ShieldAlert } from 'lucide-react'
import { isImpersonationSessionActive, maskResidentListForImpersonation } from '@/lib/impersonation-guards'
import { AdminResidentsClient, type ResidentWithAssignments } from '@/components/AdminResidentsClient'
import { ADMIN_RESIDENT_LIST_SELECT } from '@/lib/admin-resident-columns'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function AdminResidentsPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  // Pobieramy podopiecznych z organizacji tego admina — tylko kolumny potrzebne widokowi
  const { data: rawResidents } = await supabase
    .from('residents')
    .select(ADMIN_RESIDENT_LIST_SELECT)
    .order('created_at', { ascending: false })

  const { residents, masked, count } = maskResidentListForImpersonation(
    rawResidents || [],
    isImpersonating
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Podopieczni"
        description="Zarządzaj bazą podopiecznych w swojej placówce."
        actions={!isImpersonating ? (
          <>
            <ExportDataDialog />
            <BulkImportDialog />
            <AdmissionWizard />
          </>
        ) : (
          <PageHeaderNotice>Tryb podglądu (impersonacja) — formularze i eksport wyłączone</PageHeaderNotice>
        )}
      />

      {masked ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Tryb podglądu (impersonacja) — Ochrona Danych Art. 9 RODO
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-4">
            Dostęp do danych osobowych (PII) podopiecznych jest wyłączony dla Administratora platformy. 
            Wyświetlane jest wyłącznie podsumowanie statystyczne placówki.
          </p>
          <div className="inline-flex items-center gap-3 bg-card px-5 py-3 rounded-xl border border-border">
            <span className="text-sm text-muted-foreground">Liczba zarejestrowanych podopiecznych:</span>
            <span className="text-xl font-bold text-foreground">{count}</span>
          </div>
        </Card>
      ) : (
        // Klient bez typów <Database> zgaduje relację beds jako tablicę; w danych to obiekt (many-to-one).
        <AdminResidentsClient residents={(residents || []) as unknown as ResidentWithAssignments[]} />
      )}
    </div>
  )
}
