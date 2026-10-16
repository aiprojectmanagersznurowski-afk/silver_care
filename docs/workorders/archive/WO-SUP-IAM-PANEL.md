# WO: SUP-IAM-PANEL — Panel Zarządzania Tożsamością i Dostępem (IAM)

## Wymaganie
Super admin (Power Admin) posiada panel do zarządzania uprawnieniami, rolami użytkowników i ogólnym dostępem do systemu.
Z kontraktu: `R('SUP-IAM-PANEL', { source: 'SC-SUP-04', domain: 'tenancy', statement: 'Super admin (Power Admin) posiada panel do zarządzania uprawnieniami, rolami użytkowników i ogólnym dostępem do systemu.', acceptance: ['Panel widoczny i dostępny wyłącznie dla konta o roli super_admin', 'Możliwość zarządzania przypisaniem ról do kont użytkowników', 'Widok audytu zmian uprawnień zintegrowany z audit_logs'], risk: 'HIGH' })`

## Kontekst kodu
- W `contracts/requirements.contract.mjs` zdefiniowano wymaganie `SUP-IAM-PANEL` z ryzykiem `HIGH`.
- Istnieje tabela `public.audit_logs` z polityką append-only i regułą braku PII (z `20260829040000_archive_audit.sql` i `20260829110000_audit_security.sql`).
- `audit_logs` posiadała politykę ograniczoną wyłącznie do `org_admin:own`, brakowało dedykowanej polityki SELECT dla `super_admin` w całej bazie (zgodnie z `roles.contract.mjs`: `read: ['super_admin', 'org_admin:own']`).
- W `apps/web/src/app/(admin)/layout.tsx` dostęp był ograniczony wyłącznie do ról `org_admin`, brakowało obsługi `super_admin` oraz dedykowanego widoku `/admin/iam`.
- Potrzebna jest bezpieczna procedura zmiany roli (`log_role_change` / Server Action) z zapisem w `audit_logs` (`action = 'role_change'`) bez jakichkolwiek danych osobowych (PII).

## Kryteria akceptacji
1. **Dostępność i kontrola dostępu (AC1)**:
   - Widok `/admin/iam` jest dostępny wyłącznie dla kont z `role: 'super_admin'`.
   - Każda inna rola (`org_admin`, `nurse`, `family`, `legal_guardian`) oraz użytkownik nieuwierzytelniony jest blokowany i przekierowywany (403 / redirect).
   - Link do panelu IAM w `AdminSidebar` jest renderowany tylko dla użytkowników z rolą `super_admin`.
2. **Zarządzanie rolami (AC2)**:
   - Interfejs pozwala na przeglądanie użytkowników platformy oraz bezpieczną zmianę ich ról.
   - Dozwolone role wynikają z `@silvercare/contracts` (`super_admin`, `org_admin`, `nurse`, `legal_guardian`, `family`).
3. **Integracja z Rejestrem Audytowym (AC3)**:
   - Każda zmiana roli rejestruje niezmienny wpis w `audit_logs` z akcją `role_change`.
   - Wpis zawiera ID aktora (`performed_by`), ID celu (`target_user_id`), nową i poprzednią rolę w `payload`.
   - Payload spełnia regułę `SEC-NO-PII-LOGS` (zero nazwisk, PESEL, PII).
   - Panel IAM zawiera zintegrowany widok historii audytu zmian uprawnień.
4. **4 Stany UI (UI-FOUR-STATES)**:
   - Panel obsługuje i prezentuje 4 stany komponentu: Loading, Empty, Success, Error.

## Weryfikacja
- Nowy zestaw testów: `tests/db/iam_panel.test.ts` (testy bazy danych, RLS i audytu z `@REQ: SUP-IAM-PANEL`).
- Testy UI/logiki weryfikujące uprawnienia i stany widoku.
- Pełna bramka weryfikacyjna: `bash scripts/verify.sh --full` musi zakończyć się sukcesem 100% PASS.
