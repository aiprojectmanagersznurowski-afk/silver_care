# WO: SUP-FEATURE-FLAGS — Wielomodułowość platformy sterowana flagami per placówka

## Wymaganie
- Powiązane User Story: **`[SC-SUP-06]`** (`📝 PROPOZYCJA`).
- Issue GitHub: **`#303`** (rozbicie z `#297`).
- Powiązane wymagania kontraktowe: istniejące `ORG-ISOLATION`, `SUP-IMPERSONATION`, `SEC-AUDIT-APPEND-ONLY`, `SEC-NO-PII-LOGS`, `SEC-403-LOGGING`, `UI-FOUR-STATES`, `UI-TERMINOLOGY`.
- **Proponowane nowe w kontrakcie** (Etap 1 po otwarciu okna kontraktowego `SUP-FEATURE-FLAGS` przez człowieka):
  - nowy plik kontraktu: `contracts/features.contract.mjs` → codegen do `packages/contracts/src/generated/features.ts`,
  - nowe wymaganie: `SUP-FEATURE-FLAGS` (`domain: 'tenancy'`, `risk: 'HIGH'`) w `contracts/requirements.contract.mjs`,
  - nowy zasób w `contracts/roles.contract.mjs` (`RESOURCES`, `MATRIX`): `organization_feature_flags` (zapis wyłącznie `super_admin`),
  - nowa reguła bramki: **`R35-feature-flags`** w `tools/sc-validate.mjs` + żywe mutacje w `tools/sc-selftest.mjs` (`R33-voice-devices` i `R34-device-ingest` są już zajęte).
- Powiązane issues konsumenckie i rozszerzenia: `#310` (`module_audit_compliance`), `#311` (`module_shift_tasks`), `#304` (`module_voice_and_reports` + `allow_org_admin_report_config`), `#256` (`module_documents_contracts` + `allow_org_admin_contract_templates`), `#258`, `#259`, `#261`, `#229`, `#305`.

---

## Architektura: Rdzeń (`Core`) vs. 9 dużych modułów + 2 flagi delegacji

### A. Niewyłączalny Rdzeń platformy (`Core`)
Elementy podstawowe działają dla każdej placówki niezależnie od flag:
- uwierzytelnianie, sesje, RBAC, MFA i izolacja placówki (`organizations`),
- zarządzanie własnym profilem użytkownika (`/settings/profile`),
- **obowiązkowy rejestr audytowy RODO (`audit_logs`)** dla operacji wymaganych prawnie przy danych z art. 9 RODO (`AUDIT_REQUIREMENTS.mustLog`: zgody, usunięcia RODO, zmiany ról, impersonacja, publikacja raportów, zmiany flag) — zgodnie z `SEC-AUDIT-APPEND-ONLY` i ADR-013 **nie może być wyłączony flagą**.

### B. Katalog flag w `contracts/features.contract.mjs`

| Klucz flagi | `kind` | `dependsOn` | `defaultEnabled` | Zakres (trasy, API, akcje, UI) |
|---|---|---|---|---|
| `module_facility_management` | `module` | `[]` | `true` | Struktura placówki, piętra/sektory/pokoje/łóżka, asystent i reguły przydziału, personel placówki, ustawienia (`/admin/facility`, `/admin/staff`, `/admin/settings`, `/api/facility/*`, `/api/staff/invite`, `actions/facility*.ts`, `actions/bed-*.ts`, `actions/staff-management.ts`) |
| `module_residents_management` | `module` | `[]` | `true` | Ewidencja i karta podopiecznego, przyjęcie/import masowy (`#308`), poziomy opieki/ZSN, zdarzenia pobytu, kontakty bliskich/opiekunów, zgody (`consent_ledger`), tablica oddziału (`/admin/residents*`, `/staff`, `/staff/residents/[id]`, `/staff/agenda`, `/api/residents`, `/api/residents/[id]/agenda`, `/api/staff/agenda`, `actions/admission.ts`, `actions/resident-*.ts`, `actions/bulk-import.ts`) |
| `module_voice_and_reports` | `module` | `[]` | `true` | Dyktafon PWA (`/voice`), urządzenia StickS3 i stacja dokująca (`#299`, `#301`, `#307`), potok PII/MEDICAL + EU LLM, raporty dobowe, archiwum/historia raportów (`#258`), raporty operacyjne (`#304`), statystyki (`/voice`, `/staff/reports`, `/admin/reports/*`, `/api/voice/*`, `actions/bulk-reports.ts`, `StaffVoiceSyncListener`) |
| `module_shift_tasks` | `module` | `[]` | `true` | Definicje zmian, grafik z kierownikiem zmiany, zadania zmiany, wydruk A4/PDF (`#305`), checklista (`#259`), analityka realizacji (`#311`) (`/admin/shifts`, `/staff/shift-tasks`, `/staff/shift-plan/print`, `actions/shifts.ts`, `actions/shift-roster.ts`, `actions/shift-tasks.ts`, zakładka `tasks` w `ResidentCard`) |
| `module_audit_compliance` | `module` | `[]` | `false` | Rozszerzone audytowanie każdego kroku i odczytów `VIEW` (`user_activity_logs` z `#310`), rozbudowany panel `/admin/audit`, oś czasu w raportach, eksport/SIEM (`#248`). Rozszerza obowiązkowy audyt rdzeniowy RODO, nie zastępuje go. |
| `module_family_portal` | `module` | `['module_residents_management']` | `true` | Portal bliskich `(family)` (`/dashboard`, `/agenda`, `/messages`, `/consents`), zaproszenia (`/admin/invitations`), komunikator (`/admin/messages`), powiadomienia dla rodzin, 30-dniowe archiwum (`/api/messages`, `/api/admin/messages`, `/api/family/*`, `/api/residents/[id]/report/latest`) |
| `module_documents_contracts` | `module` | `['module_residents_management']` | `true` | Repozytorium umów, szablony, generowanie PDF z ulotnym PESEL, obieg podpisu (odręczny / Profil Zaufany), załączniki umów na karcie podopiecznego (`/api/admin/residents/[id]/contract`, `ResidentContractCard`, docelowo `/admin/contracts` z `#256`) |
| `module_finance_budget` | `module` | `['module_facility_management']` | `false` | Planowanie budżetu, wycena łóżek i usług dodatkowych, źródła finansowania (`#246`), pulpit rentowności `/admin/budget` bez fakturowania (`#261`) |
| `module_wearables_iot` | `module` | `['module_residents_management']` | `true` | Parowanie opasek (`external_wearable_links`), integracja Polar i przyszłe bramki BLE (`#229`), metryki behawioralne z granicą MDR (`/api/polar/*`, zakładka `wearable` / `PolarWearableCard` w `ResidentCard`) |
| `allow_org_admin_report_config` | `delegation` | `['module_voice_and_reports']` | `false` | Delegacja (`super_admin` → `org_admin`): konfiguracja aktywnych typów raportów operacyjnych własnej placówki w `/admin/settings` (`#304`) |
| `allow_org_admin_contract_templates` | `delegation` | `['module_documents_contracts']` | `false` | Delegacja (`super_admin` → `org_admin`): zarządzanie szablonami umów własnej placówki (`#256`) |

---

## Stan wyjściowy i wykryte pułapki w kodzie

1. **Trasy API poza `withAuth`:**
   - Obecnie `withAuth` z `apps/web/src/lib/api-auth.ts` używają tylko 3 trasy (`api/residents`, `api/facility/rooms`, `api/facility/beds`).
   - Pozostałe trasy modułowe (`/api/voice/*`, `/api/polar/*`, `/api/messages`, `/api/admin/messages`, `/api/family/*`, `/api/admin/residents/[id]/contract`, `/api/residents/[id]/report/latest`, `/api/residents/[id]/agenda`, `/api/staff/*`) weryfikują sesję ręcznie.
   - **Rozwiązanie:** wspólny helper `assertOrgFeatureForApi(...)` używany wewnątrz `withAuth` (gdy podano `requiredFeature`) i wpinany w istniejące trasy. Publiczne trasy bez sesji (`/api/polar/webhook`, `/api/family/register`, `/api/family/invite/validate`) sprawdzają flagę przez `has_org_feature` / zapytanie serwerowe dla `organization_id` z rekordu powiązania lub zaproszenia.
2. **Brak bezpośredniego `INSERT` do `audit_logs` dla `super_admin`:**
   - Polityka `audit_logs_insert` wymaga `organization_id = public.get_jwt_organization_id()`, a `super_admin` ma `organization_id = NULL` w JWT.
   - **Rozwiązanie:** zapis flag, walidacja zależności, kaskadowe wyłączanie dzieci oraz zapis `ORG_FEATURE_FLAG_UPDATED` w `audit_logs` realizuje jedna funkcja RPC `public.set_organization_feature_flag(...)` (`SECURITY DEFINER`), gwarantująca atomowość AC4 + AC5 w jednej transakcji.
3. **Pętla przekierowań dla `module_family_portal`:**
   - `apps/web/src/lib/supabase/middleware.ts` przekierowuje role `family` / `legal_guardian` z `/` na `/dashboard`.
   - **Rozwiązanie:** przy wyłączonym `module_family_portal` layout `apps/web/src/app/(family)/layout.tsx` nie wykonuje `redirect('/')` i nie pobiera danych podopiecznych — renderuje bezpośrednio stan `ListEmpty` z przyciskiem wylogowania.
4. **Wspólna baza Supabase dla `staging` i `main`:**
   - Migracja SQL musi być wyłącznie przyrostowa (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, bez łamania istniejących zapytań) i testowana wyłącznie na lokalnej bazie przed scaleniem do `staging`/`main`.
   - Moduły działające obecnie w systemie mają `defaultEnabled: true`, przyszłe oraz flagi delegacji `false`.
5. **Tryb impersonacji Super Admina:**
   - Zapis flag w trybie impersonacji jest zawsze odrzucany (`blockImpersonation: true` w Server Action + kontrola claimu `impersonator_id` w RLS i RPC).
   - Podczas podglądu placówki (`impersonationSession.targetOrgId`) `AdminLayout` i `AdminSidebar` odczytują flagi docelowej placówki, dzięki czemu Super Admin widzi dokładnie te moduły, które są w niej aktywne.

---

## Projekt danych, RLS i RPC (`supabase/migrations/`)

1. **Katalog bazodanowy lub spójna funkcja SQL (`public.feature_flag_defaults` / definicja w migracji):**
   - Przechowuje listę dozwolonych `feature_key`, ich `default_enabled` oraz `depends_on text[]`.
   - Test `tests/db/feature_flags.test.ts` porównuje 1:1 klucze, `defaultEnabled` i `dependsOn` z `@silvercare/contracts`, eliminując dryf między kontraktem a SQL.
2. **Tabela `public.organization_feature_flags`:**
   - `organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`
   - `feature_key text NOT NULL` (ograniczony kluczem obcym lub `CHECK` do katalogu kluczy kontraktu)
   - `enabled boolean NOT NULL`
   - `updated_by uuid NOT NULL REFERENCES auth.users(id)`
   - `updated_at timestamptz NOT NULL DEFAULT now()`
   - `PRIMARY KEY (organization_id, feature_key)`
3. **Polityki RLS na `organization_feature_flags`:**
   - `SELECT`: `super_admin` widzi wszystkie wiersze; role placówki (`org_admin`, `nurse`, `legal_guardian`, `family`) wyłącznie `organization_id = public.get_jwt_organization_id()`.
   - `INSERT` / `UPDATE` / `DELETE`: wyłącznie `super_admin` przy braku `impersonator_id` w JWT.
   - Restrykcyjna polityka MFA: `AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement())`.
4. **Funkcja `public.has_org_feature(p_org_id uuid, p_feature_key text) RETURNS boolean`:**
   - `STABLE SECURITY DEFINER SET search_path = 'public', 'pg_temp'`.
   - Fail-closed dla nieznanego `p_feature_key` lub `p_org_id IS NULL` → `false`.
   - Zwraca `true` wyłącznie wtedy, gdy docelowa flaga oraz **wszyscy jej przodkowie** w grafie `dependsOn` są efektywnie włączeni (nadpisanie z `organization_feature_flags` albo `defaultEnabled` z katalogu).
5. **Atomowy RPC `public.set_organization_feature_flag(p_org_id uuid, p_feature_key text, p_enabled boolean) RETURNS jsonb`:**
   - `SECURITY DEFINER SET search_path = 'public', 'pg_temp'`.
   - Sprawdza: rolę `super_admin` w JWT `app_metadata`, brak `impersonator_id`, `public.check_mfa_requirement()`, istnienie `p_org_id` oraz poprawność `p_feature_key`.
   - Gdy `p_enabled = true`: jeśli którykolwiek przodek `dependsOn` ma `has_org_feature(...) = false`, rzuca `FEATURE_DEPENDENCY_DISABLED` (`23514`).
   - Gdy `p_enabled = false`: w jednej transakcji wykonuje `UPSERT` na docelowej fladze oraz kaskadowo ustawia `enabled = false` dla wszystkich aktywnych modułów potomnych i delegacji zależnych.
   - Dla każdej faktycznie zmienionej flagi dopisuje wpis do `public.audit_logs` (`organization_id = p_org_id`, `action = 'ORG_FEATURE_FLAG_UPDATED'`, `performed_by = auth.uid()`, `payload = jsonb_build_object('feature_key', ..., 'previous_value', ..., 'new_value', ..., 'cascade_from', ...)` — zero PII).

---

## Projekt warstwy aplikacyjnej i UI (`apps/web`)

- **Moduł rdzeniowy `apps/web/src/lib/feature-flags.ts` (≤ 250 LOC):**
  - `getOrgFeatureFlags(organizationId)`: opakowane w `React.cache`, jedno zapytanie `SELECT feature_key, enabled FROM organization_feature_flags WHERE organization_id = $1` per żądanie (zero zapytań N+1), wyliczenie pełnej mapy efektywnych flag z uwzględnieniem `dependsOn` z kontraktu.
  - `requireOrgFeature(featureKey)`: weryfikacja bieżącego użytkownika (`getCurrentUser()`), wyznaczenie kontekstu `organizationId` (lub `impersonationSession.targetOrgId` dla podglądu) i zwrócenie jawnego wyniku `{ allowed, feature, organizationId }`.
  - `assertOrgFeatureForApi(supabase, user, featureKey, pathname)`: zwraca `null` gdy dozwolone, albo `NextResponse.json({ error, code: 'FEATURE_DISABLED_FOR_ORG', feature }, { status: 403 })` + log techniczny bez PII (`[FEATURE_DISABLED_403] user_id=... org_id=... feature=... path=...`, `@REQ: SEC-403-LOGGING`).
- **Wrapper `apps/web/src/lib/api-auth.ts`:**
  - Rozszerzenie `WithAuthOptions` o `requiredFeature?: FeatureKey`.
- **Server Actions `apps/web/src/actions/organization-feature-flags.ts` (≤ 250 LOC):**
  - `toggleOrganizationFeatureFlagAction`: weryfikacja `getAppRole(user) === 'super_admin'`, odrzucenie przy aktywnej impersonacji, wywołanie RPC `set_organization_feature_flag` sesją użytkownika (bez `service_role`), `revalidatePath` dla `/admin/organizations/${organizationId}` i layoutów.
- **Panel Super Admina w `apps/web/src/app/(admin)/admin/organizations/[id]/page.tsx`:**
  - `<OrganizationFeatureFlagsSection />` (< 250 LOC; w razie potrzeby wydzielony komponent wiersza/dialogu):
    - dwie sekcje: **„Moduły placówki”** oraz **„Delegacja uprawnień dla Kierownika placówki”**,
    - komponenty z `components/patterns/`: `TableCard` (`Table`, `TableStateRow`), `StatusBadge` (`neutral`/`brand`), `Switch` z celem dotykowym `min-h-touch`, 4 stany UI (`loading`, `empty`, `success`, `error`), brak surowej palety Tailwind, terminologia `UI_TERMINOLOGY`,
    - wyłączony przełącznik dla flag potomnych z nieaktywnym rodzicem (z czytelnym opisem zależności),
    - `ConfirmDialog` przy wyłączaniu modułu mającego aktywne moduły potomne lub delegacje (lista flag, które zostaną wyłączone kaskadowo),
    - wszystkie przełączniki `disabled` w trybie impersonacji.
- **Komponent stanu blokady `<FeatureDisabledState />`:**
  - Oparty o `ListEmpty` (z `components/patterns/ListState.tsx`), renderowany po stronie serwera przy ręcznym wejściu na URL wyłączonego modułu bez zapytań o dane domenowe.

---

## Podział na kroki (`CONTRACT → RED → GREEN → VERIFY`, ≤ 3 pliki na commit)

| Etap | Zakres | Kluczowe pliki | Okno kontraktowe | Test RED / weryfikacja |
|---|---|---|---|---|
| **0** | Specyfikacja `[SC-SUP-06]` + Work Order `WO-SUP-FEATURE-FLAGS.md` | `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md`, `docs/workorders/WO-SUP-FEATURE-FLAGS.md` | nie | `bash scripts/verify.sh` |
| **1** | Kontrakt + codegen + bramka (`R35-feature-flags`, mutacje `sc-selftest`) | `contracts/features.contract.mjs`, `roles.contract.mjs`, `requirements.contract.mjs`, `tools/sc-{codegen,validate,selftest}.mjs`, `packages/contracts/src/generated/*` | **TAK** (otwiera człowiek) | `sc-validate`, `sc-selftest`, `sc-codegen --check` |
| **2** | Migracja DB: `organization_feature_flags`, RLS, `has_org_feature`, RPC `set_organization_feature_flag`, typy | `supabase/migrations/*`, `database.types.ts`, `tests/db/feature_flags.test.ts` | nie | `tests/db/feature_flags.test.ts` (AC1/AC2/AC4/AC5 + parytet SQL↔kontrakt) |
| **3** | Rdzeń `feature-flags.ts` + rozszerzenie `withAuth` w `api-auth.ts` | `apps/web/src/lib/feature-flags.ts`, `api-auth.ts`, `tests/logic/feature_flags.test.ts` | nie | `tests/logic/feature_flags.test.ts`, `tsc --noEmit` |
| **4** | Panel Super Admina na `/admin/organizations/[id]` | `actions/organization-feature-flags.ts`, `OrganizationFeatureFlagsSection.tsx` (+ podkomponent), `organizations/[id]/page.tsx` | nie | Vitest + `verify.sh` kroki 6–7 |
| **5a** | Guardy SSR: layouty i sidebary `(admin)`, `(staff)`, `(family)` + `FeatureDisabledState` | `layout.tsx` + `AdminSidebar`/`StaffSidebar`, `FeatureDisabledState.tsx` | nie | Vitest + `tsc` (brak pętli przekierowań) |
| **5b** | Guardy stron i Server Actions (`facility`, `residents`, `shifts`, `voice`, `staff`) | wybrane `page.tsx` i `actions/*.ts` (≤ 3 pliki na commit) | nie | Vitest + `tsc` |
| **5c** | Guardy API routes (`voice/*`, `polar/*`, `messages`, `family/*`, `contract`, `facility/*`, `residents/*`) + `ResidentCard` | `app/api/**/route.ts`, `ResidentCard.tsx` (≤ 3 pliki na commit) | nie | testy integracyjne API `403 FEATURE_DISABLED_FOR_ORG` |
| **6** | Playwright E2E + pełna bramka końcowa | `e2e/page-objects/*`, `e2e/feature-flags.spec.ts` (`@REQ: SUP-FEATURE-FLAGS`) | nie | `pnpm test:e2e`, `bash scripts/verify.sh --full` |

---

## Granice, ryzyka i weryfikacja
- **RODO art. 9 i MDR:** wyłączenie dowolnego modułu nigdy nie wyłącza `audit_logs`, nie odsłania danych w fallbackach i nie zmienia granicy MDR. W logach 403 wyłącznie UUID i kody (`SEC-403-LOGGING`, `SEC-NO-PII-LOGS`).
- **Standard UI:** wszystkie nowe komponenty ≤ 250 LOC, `PageHeader`, `TableCard`, `StatusBadge` (`neutral`/`brand`), `min-h-touch`, skala `14px`/`12px`, terminologia `UI_TERMINOLOGY`.
- **Weryfikacja końcowa:** każdy etap przechodzi `node tools/sc-phase.mjs`, `bash scripts/verify.sh --full` oraz po stronie frontendu `pnpm test:e2e`.
