import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Card } from '@/components/ui/card'
import { AdmissionWizard } from '@/components/AdmissionWizard'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ExportDataDialog } from '@/components/ExportDataDialog'
import { ShieldAlert } from 'lucide-react'
import { isImpersonationSessionActive, maskResidentListForImpersonation } from '@/lib/impersonation-guards'
import { AdminResidentsClient, type ResidentWithAssignments } from '@/components/AdminResidentsClient'
// Komponenty edycji inline i arkusza zintegrowane w tabeli podopiecznych (AdminResidentsClient)
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'

export default async function AdminResidentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  // Pobieramy wszystkich pensjonariuszy z organizacji tego admina
  const { data: rawResidents } = await supabase
    .from('residents')
    .select('*, bed_assignments(id, unassigned_at, beds(id, label, rooms(number)))')
    .order('created_at', { ascending: false })

  const { residents, masked, count } = maskResidentListForImpersonation(
    rawResidents || [],
    isImpersonating
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Baza Podopiecznych
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Zarządzanie pensjonariuszami, przypisaniem do łóżek i poziomami opieki.
          </p>
        </div>
        {!masked ? (
          <div className="flex items-center gap-3">
            <ExportDataDialog />
            <BulkImportDialog />
            <AdmissionWizard />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-xs font-medium text-foreground border border-border">
            <span>Tryb podglądu (impersonacja) — formularze i eksport wyłączone</span>
          </div>
        )}
      </div>

      {masked ? (
        <Card className="rounded-xl border border-border bg-primary p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Tryb podglądu (impersonacja) — Ochrona Danych Art. 9 RODO
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-4">
            Dostęp do danych osobowych (PII) podopiecznych jest wyłączony dla Super Administratora. 
            Wyświetlane jest wyłącznie podsumowanie statystyczne placówki.
          </p>
          <div className="inline-flex items-center gap-3 bg-card px-5 py-3 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground">Liczba zarejestrowanych podopiecznych:</span>
            <span className="text-xl font-bold text-foreground">{count}</span>
          </div>
        </Card>
      ) : (
        <AdminResidentsClient residents={(residents || []) as ResidentWithAssignments[]} />
      )}
    </div>
  )
}
