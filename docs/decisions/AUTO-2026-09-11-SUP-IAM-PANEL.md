# Decyzja Autonomiczna: AUTO-2026-09-11-SUP-IAM-PANEL

- **Data**: 2026-09-11
- **Dotyczy wymagania**: `SUP-IAM-PANEL` (Karta Trello: `6aa3e33e4ca17c01af8ef877`)
- **Klasa decyzji**: `[AUTO_LOGGED]`

## Kontekst
Wymóg `SUP-IAM-PANEL` nakłada obowiązek udostępnienia Super Adminowi panelu do zarządzania tożsamością i uprawnieniami (IAM) oraz zintegrowanego wglądu w rejestr audytowy zmian ról (`audit_logs`).

## Podjęte decyzje projektowe
1. **Dostępność i nawigacja**:
   - Ścieżka `/admin/iam` jest ściśle zabezpieczona rolą `super_admin`.
   - Element w nawigacji bocznej (`AdminSidebar`) oraz mobilnej (`AdminMobileHeader`) jest renderowany wyłącznie dla roli `super_admin`.
2. **Schemat i polityki bazy danych**:
   - `public.audit_logs.organization_id` zostało przekształcone na pole opcjonalne (`DROP NOT NULL`), co umożliwia rejestrowanie globalnych operacji administracyjnych nieprzypisanych do konkretnej placówki.
   - Dodano politykę RLS `audit_logs_super_admin_select` umożliwiającą roli `super_admin` przeglądanie logów systemowych (zgodnie z `roles.contract.mjs`).
   - Utworzono procedurę `public.log_role_change` z walidacją ról i zapisem w `audit_logs` z zerową ilością danych PII (`SEC-NO-PII-LOGS`).
3. **Wzorzec UI i 4 Stany (UI-FOUR-STATES)**:
   - Komponent `IamManagementClient` obsługuje stany: `Loading`, `Empty`, `Success`, `Error`.
   - Zgodnie z wytycznymi dodano stories w `apps/web/src/stories/IamManagement.stories.tsx`.
