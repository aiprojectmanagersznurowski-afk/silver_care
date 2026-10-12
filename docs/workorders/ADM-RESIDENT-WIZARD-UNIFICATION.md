# Work Order: ADM-RESIDENT-WIZARD-UNIFICATION

## Cel
Unifikacja procesu przyjmowania nowego podopiecznego w kartotece (`/admin/residents`) poprzez usunięcie przestarzałego przycisku `AddResidentDialog` na rzecz kanonicznego kreatora `AdmissionWizard` („Nowe Przyjęcie (Kreator)”), zapobiegając tworzeniu niekompletnych rekordów bez alokacji łóżka oraz eliminując dezorientację użytkownika.

## Zakres wdrożenia
1. **Widok kartoteki podopiecznych (`apps/web/src/app/(admin)/admin/residents/page.tsx`):**
   - Usunięcie importu i renderowania `<AddResidentDialog />`.
   - Pozostawienie uporządkowanego paska akcji: `ExportDataDialog`, `BulkImportDialog`, `AdmissionWizard`.
2. **Kreator przyjęcia (`apps/web/src/components/AdmissionWizard.tsx`):**
   - Etykieta przycisku otwierającego: „Nowe Przyjęcie (Kreator)”.
   - Standaryzacja słownictwa: zamiana wszelkich form „pensjonariusz” na „podopieczny”.
3. **Komponent `apps/web/src/components/AddResidentDialog.tsx`:**
   - Oznaczenie jako `@deprecated`.
