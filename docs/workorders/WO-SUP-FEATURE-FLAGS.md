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
| `module_residents_management` | `module` | `[]` | `true` | Ewidencja i karta podopiecznego, przyjęcie/import masowy (`#308`), poziomy opieki/ZSN, zdarzenia pobytu, kontakty bliskich/opiekunów, zgody (`consent_ledger`), tablica oddziału (`/admin/residents*`, `/staff`, `/staff/residents/[id]`, `/staff/agenda`, `/api/residents`, `/api/admin/residents/*`, `/api/residents/[id]/agenda`, `/api/staff/agenda`, `actions/admission.ts`, `actions/resident-*.ts`, `actions/bulk-import.ts`) |
| `module_voice_and_reports` | `module` | `[]` | `true` | Dyktafon PWA (`/voice`), urządzenia StickS3 i stacja dokująca (`#299`, `#301`, `#307`), potok PII/MEDICAL + EU LLM, raporty dobowe, archiwum/historia raportów (`#258`), raporty operacyjne (`#304`), statystyki (`/voice`, `/staff/reports`, `/admin/reports/*`, `/api/voice/*`, `actions/bulk-reports.ts`, `StaffVoiceSyncListener`) |
| `module_shift_tasks` | `module` | `[]` | `true` | Definicje zmian, grafik z kierownikiem zmiany, zadania zmiany, wydruk A4/PDF (`#305`), checklista (`#259`), analityka realizacji (`#311`) (`/admin/shifts`, `/staff/shift-tasks`, `/staff/shift-plan/print`, `actions/shifts.ts`, `actions/shift-roster.ts`, `actions/shift-tasks.ts`, zakładka `tasks` w `ResidentCard`) |
| `module_audit_compliance` | `module` | `[]` | `false` | Rozszerzone audytowanie każdego kroku i odczytów `VIEW` (`user_activity_logs` z `#310`), rozbudowany panel `/admin/audit`, oś czasu w raportach, eksport/SIEM (`#248`). Rozszerza obowiązkowy audyt rdzeniowy RODO, nie zastępuje go. |
| `module_family_portal` | `module` | `['module_residents_management']` | `true` | Portal bliskich `(family)` (`/dashboard`, `/agenda`, `/messages`, `/consents`), zaproszenia (`/admin/invitations`), komunikator (`/admin/messages`), powiadomienia dla rodzin, 30-dniowe archiwum (`/api/messages`, `/api/admin/messages`, `/api/admin/residents/[id]/messages`, `/api/family/*`, `/api/residents/[id]/report/latest`, `/api/residents/[id]/agenda`) |
| `module_documents_contracts` | `module` | `['module_residents_management']` | `true` | Repozytorium umów, szablony, generowanie PDF z ulotnym PESEL, obieg podpisu (odręczny / Profil Zaufany), załączniki umów na karcie podopiecznego (`/api/admin/residents/[id]/contract`, `ResidentContractCard`, docelowo `/admin/contracts` z `#256`) |
| `module_finance_budget` | `module` | `['module_facility_management']` | `false` | Planowanie budżetu, wycena łóżek i usług dodatkowych, źródła finansowania (`#246`), pulpit rentowności `/admin/budget` bez fakturowania (`#261`) |
| `module_wearables_iot` | `module` | `['module_residents_management']` | `true` | Parowanie opasek (`external_wearable_links`), integracja Polar i przyszłe bramki BLE (`#229`), metryki behawioralne z granicą MDR (`/api/polar/*`, zakładka `wearable` / `PolarWearableCard` w `ResidentCard`) |
| `allow_org_admin_report_config` | `delegation` | `['module_voice_and_reports']` | `false` | Delegacja (`super_admin` → `org_admin`): konfiguracja aktywnych typów raportów operacyjnych własnej placówki w `/admin/settings` (`#304`) |
| `allow_org_admin_contract_templates` | `delegation` | `['module_documents_contracts']` | `false` | Delegacja (`super_admin` → `org_admin`): zarządzanie szablonami umów własnej placówki (`#256`) |

#### Kanoniczne mapowanie i trasy wieloflagowe (`REQUIRE_ALL_MATCHING`)
- Dla tras objętych więcej niż jednym wzorcem `apiPrefixes` obowiązuje reguła `FEATURE_FLAG_POLICY.multiFlagRoutePolicy = 'REQUIRE_ALL_MATCHING'` (iloczyn logiczny AND — wyłączenie którejkolwiek pasującej flagi blokuje endpoint kodem `403 FEATURE_DISABLED_FOR_ORG`).
- Wygenerowane z kontraktu funkcje `matchesFeatureApiPattern(pathname, pattern)` i `getRequiredFeaturesForApiPath(pathname)` (w `@silvercare/contracts/generated/features`) zwracają m.in.:
  - `/api/residents/[id]/report/latest` → `['module_residents_management', 'module_family_portal']`,
  - `/api/residents/[id]/agenda` → `['module_residents_management', 'module_family_portal']`,
  - `/api/admin/residents/[id]/messages` → `['module_residents_management', 'module_family_portal']`,
  - `/api/admin/residents/[id]/contract` → `['module_residents_management', 'module_documents_contracts']`.

---

## Stan wyjściowy i wykryte pułapki w kodzie

1. **Trasy API poza `withAuth` i ścieżki wieloflagowe:**
   - Obecnie `withAuth` z `apps/web/src/lib/api-auth.ts` używają tylko 3 trasy (`api/residents`, `api/facility/rooms`, `api/facility/beds`).
   - Pozostałe trasy modułowe (`/api/voice/*`, `/api/polar/*`, `/api/messages`, `/api/admin/messages`, `/api/admin/residents/[id]/messages`, `/api/family/*`, `/api/admin/residents/[id]/contract`, `/api/residents/[id]/report/latest`, `/api/residents/[id]/agenda`, `/api/staff/*`) weryfikują sesję ręcznie.
   - **Rozwiązanie:** wspólny helper `assertOrgFeatureForApi(...)` (obsługujący pojedynczą flagę oraz automatycznie tablicę z `getRequiredFeaturesForApiPath(pathname)` według `REQUIRE_ALL_MATCHING`), używany wewnątrz `withAuth` i wpinany w istniejące trasy. Publiczne trasy bez sesji (`/api/polar/webhook`, `/api/family/register`, `/api/family/invite/validate`) sprawdzają flagę przez klienta serwerowego (`service_role`) wywołującego `has_org_feature(org_id, feature_key)` dla `organization_id` z rekordu powiązania lub zaproszenia.
2. **Jedna ścieżka zapisu (`RPC_ONLY`) i brak bezpośredniego `INSERT` do `audit_logs` dla `super_admin`:**
   - Polityka `audit_logs_insert` wymaga `organization_id = public.get_jwt_organization_id()`, a `super_admin` ma `organization_id = NULL` w JWT; ponadto bezpośrednie mutacje tabeli `organization_feature_flags` groziłyby obejściem walidacji zależności, kaskady lub audytu.
   - **Rozwiązanie:** tabela `organization_feature_flags` w sesjach aplikacyjnych (`authenticated`, `anon`) jest wyłącznie do odczytu (`REVOKE INSERT, UPDATE, DELETE`, brak polityk zapisu). Zapis flag, walidacja zależności, kaskadowe wyłączanie dzieci oraz zapis `ORG_FEATURE_FLAG_UPDATED` w `audit_logs` realizuje wyłącznie atomowa funkcja RPC `public.set_organization_feature_flag(...)` (`SECURITY DEFINER`).
3. **Pętla przekierowań dla `module_family_portal`:**
   - `apps/web/src/lib/supabase/middleware.ts` przekierowuje role `family` / `legal_guardian` z `/` na `/dashboard`.
   - **Rozwiązanie:** przy wyłączonym `module_family_portal` layout `apps/web/src/app/(family)/layout.tsx` nie wykonuje `redirect('/')` i nie pobiera danych podopiecznych — renderuje bezpośrednio stan `ListEmpty` z przyciskiem wylogowania.
4. **Wspólna baza Supabase dla `staging` i `main`:**
   - Migracja SQL musi być wyłącznie przyrostowa (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, bez łamania istniejących zapytań) i testowana wyłącznie na lokalnej bazie przed scaleniem do `staging`/`main`.
   - Moduły działające obecnie w systemie mają `defaultEnabled: true`, przyszłe oraz flagi delegacji `false`.
5. **Tryb faktycznej impersonacji Super Admina (`APP_COOKIE_AND_DB_SESSION`):**
   - Obecny przepływ w `apps/web/src/actions/impersonation.ts` zapisuje `sc_impersonation` w ciasteczku httpOnly (TTL 1h) i wywołuje `log_impersonation_start`, natomiast JWT `super_admin` w sesji aplikacyjnej nie zawiera claimu `impersonator_id`.
   - **Rozwiązanie:** powstaje wewnętrzna tabela stanu `public.active_impersonation_sessions` (bez uprawnień i polityk dla `authenticated`/`anon`, zarządzana wyłącznie przez `SECURITY DEFINER`), wpisywana w `log_impersonation_start` (z TTL = 1h spójnym z ciasteczkiem `sc_impersonation`) i usuwana w `log_impersonation_stop` (oraz przy wylogowaniu w `apps/web/src/app/auth/signout/route.ts` przed `supabase.auth.signOut()`). Funkcja `set_organization_feature_flag` odrzuca zapis (`42501`), gdy dla wywołującego `super_admin` istnieje aktywny (niewygasły) rekord w `active_impersonation_sessions` **lub** gdy JWT zawiera `impersonator_id`. Server Action dodatkowo blokuje zapis po wykryciu ciasteczka `sc_impersonation`.
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
3. **Polityki RLS i wyłączna ścieżka zapisu na `organization_feature_flags`:**
   - `SELECT`: `super_admin` widzi wszystkie wiersze; role placówki (`org_admin`, `nurse`, `legal_guardian`, `family`) wyłącznie `organization_id = public.get_jwt_organization_id()`.
   - Restrykcyjna polityka MFA: `AS RESTRICTIVE FOR ALL USING (public.check_mfa_requirement())`.
   - **Zero polityk `INSERT`/`UPDATE`/`DELETE` + `REVOKE INSERT, UPDATE, DELETE ON TABLE public.organization_feature_flags FROM PUBLIC, anon, authenticated`:** bezpośredni zapis z sesji aplikacyjnych (w tym przez `super_admin`) jest bezwzględnie odrzucany przez PostgreSQL. Jedyny zapis wykonuje `public.set_organization_feature_flag(...)`.
4. **Odczyt flag w granicach placówki (`has_org_feature` i `has_resident_org_feature`):**
   - `REVOKE ALL ON FUNCTION public.has_org_feature(uuid, text) FROM PUBLIC, anon;` `GRANT EXECUTE ... TO authenticated, service_role;` (oraz analogicznie dla `has_resident_org_feature(uuid, text)`).
   - Obie funkcje mają `STABLE SECURITY DEFINER SET search_path = 'public', 'pg_temp'` i fail-closed dla nieznanego `p_feature_key` lub `NULL` (`false`).
   - **Autoryzacja odczytu (cross-tenant denied):** gdy wywołującym jest sesja `authenticated` bez roli `super_admin` (sprawdzanej po JWT), funkcja dopuszcza wyłącznie `p_org_id = public.get_jwt_organization_id()` — zapytanie o obcą placówkę zawsze zwraca `false` (nie ujawnia konfiguracji innego tenanta). Wywołania jako `super_admin` oraz zaufane ścieżki serwerowe (`service_role` / `postgres`, używane w publicznych endpointach `/api/polar/webhook`, `/api/family/register`, `/api/family/invite/validate` i w wewnętrznych triggerach) mogą pytać o dowolne docelowe `p_org_id`.
   - Zwraca `true` wyłącznie wtedy, gdy docelowa flaga oraz **wszyscy jej przodkowie** w grafie `dependsOn` są efektywnie włączeni (nadpisanie z `organization_feature_flags` albo `defaultEnabled` z katalogu).
   - `has_resident_org_feature(p_resident_id uuid, p_feature_key text)` pobiera `organization_id` z `residents` (wewnętrznie pod `SECURITY DEFINER`, bez wymagania `SELECT` na `residents` przez bliskich — zachowanie `SC-FAM-08`) i deleguje do sprawdzenia flagi z tą samą regułą autoryzacji.
5. **Atomowy RPC `public.set_organization_feature_flag(p_org_id uuid, p_feature_key text, p_enabled boolean) RETURNS jsonb`:**
   - `SECURITY DEFINER SET search_path = 'public', 'pg_temp'`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`.
   - Zakłada blokadę transakcyjną `pg_advisory_xact_lock(hashtext('org_ff:' || p_org_id::text))`.
   - Sprawdza: rolę `super_admin` w JWT `app_metadata`, `public.check_mfa_requirement()`, brak claimu `impersonator_id` w JWT **oraz brak aktywnego (niewygasłego, TTL 1h) rekordu w `public.active_impersonation_sessions` dla `auth.uid()`** (odmowa `insufficient_privilege` / `42501`), istnienie `p_org_id` oraz poprawność `p_feature_key`.
   - Gdy `p_enabled = true`: jeśli którykolwiek przodek `dependsOn` ma efektywną wartość `false`, rzuca `FEATURE_DEPENDENCY_DISABLED` (`23514`).
   - Gdy `p_enabled = false`: w jednej transakcji wykonuje `UPSERT` na docelowej fladze oraz kaskadowo ustawia `enabled = false` dla wszystkich efektywnie aktywnych modułów potomnych i delegacji zależnych.
   - Dla **każdej faktycznie zmienionej** flagi (porównanie poprzedniego i nowego stanu efektywnego — powtórne ustawienie tej samej wartości nie generuje zbędnego audytu) dopisuje niemutowalny wpis do `public.audit_logs` (`organization_id = p_org_id`, `action = 'ORG_FEATURE_FLAG_UPDATED'`, `performed_by = auth.uid()`, `payload = jsonb_build_object('feature_key', ..., 'previous_value', ..., 'new_value', ..., 'cascade_from', ...)` — zero PII).
6. **Egzekwowanie flag w politykach RLS i domenowych RPC (`rlsEnforcementRequired: true`):**
   - Poza gardami UI/API/Server Actions migracja z Etapu 2 dokłada restrykcyjne warunki flagowe w warstwie bazy (bez ruszania niewyłączalnego Rdzenia `audit_logs`, `organizations`, `profiles`):
     - **`module_family_portal`**:
       - `daily_reports` (polityka SELECT dla bliskich: zaktualizowana przez `has_resident_org_feature(daily_reports.resident_id, 'module_family_portal')` — spójne z `SC-FAM-08`),
       - `resident_media` (polityka SELECT dla bliskich z użyciem `has_resident_org_feature`),
       - `agenda_items` (`agenda_items_family_select` z użyciem `has_org_feature(organization_id, 'module_family_portal')`),
       - `family_messages` i `resident_invitations` (restrykcyjna polityka `AS RESTRICTIVE` na `has_org_feature(organization_id, 'module_family_portal')`),
       - RPC `get_family_resident_overview()` (zwraca pusty zbiór, gdy `module_family_portal` wyłączony), `is_relative_active_or_retained()`, `family_has_active_link_in_org()`,
       - trigger `notify_on_report_published()` (nie kolejkuje `outbox_notifications` dla rodziny przy wyłączonym `module_family_portal`).
     - **`module_voice_and_reports`**:
       - restrykcyjne polityki `AS RESTRICTIVE` na `voice_draft_notes`, `daily_logs`, `voice_devices`, `voice_device_assignments` oraz polityki personelu na `daily_reports` + strażnik w `process_voice_draft_atomic`.
     - **`module_shift_tasks`**:
       - restrykcyjne polityki `AS RESTRICTIVE` na `shift_definitions`, `shift_roster`, `shift_tasks`, `shift_plan_approvals` + strażniki w `settle_shift_task` i `record_shift_plan_print`.
     - **`module_wearables_iot`**:
       - restrykcyjna polityka `AS RESTRICTIVE` na `external_wearable_links`.
     - **Rdzeń (`audit_logs`)**: zero ograniczeń flagowych — wpisy RODO i odczyt dla placówki B oraz `super_admin` działają zawsze.
   - Zakres obowiązkowego testu DB (`tests/db/feature_flags.test.ts`):
     - parytet 1:1 katalogu SQL z `@silvercare/contracts`,
     - odmowa bezpośredniego `INSERT`/`UPDATE`/`DELETE` na `organization_feature_flags` (także jako `super_admin`),
     - pełny test faktycznego przepływu impersonacji (`log_impersonation_start` → odmowa `set_organization_feature_flag` → `log_impersonation_stop` → zapis dozwolony) + test claimu `impersonator_id` w JWT,
     - kompletność i brak duplikatów wpisów `ORG_FEATURE_FLAG_UPDATED` (zero PII) przy włączaniu, wyłączaniu z kaskadą i idempotentnym powtórzeniu,
     - autoryzacja `has_org_feature` (odmowa dla `anon`, `false` przy zapytaniu cross-tenant zwykłego `authenticated`),
     - egzekwowanie RLS/RPC po wyłączeniu `module_family_portal` w placówce A: odmowa odczytu `daily_reports` i `get_family_resident_overview()` dla bliskiego placówki A, przy jednoczesnym zachowaniu pełnego dostępu bliskiego placówki B i działającym zapisie/odczycie `audit_logs`.

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
| **2** | Migracja DB: `organization_feature_flags` (tylko odczyt w RLS, zapis `RPC_ONLY`), `active_impersonation_sessions` (+ wylogowanie w `signout/route.ts`), `has_org_feature` / `has_resident_org_feature`, RPC `set_organization_feature_flag`, egzekwowanie w RLS/RPC domenowych, typy | `supabase/migrations/*`, `apps/web/src/app/auth/signout/route.ts`, `database.types.ts`, `tests/db/feature_flags.test.ts` | nie | `tests/db/feature_flags.test.ts` (AC1–AC5, brak bezpośredniego zapisu, faktyczna impersonacja, RLS/RPC cross-tenant) |
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

## Przygotowanie środowiska do wdrożenia

- Włącz rejestrację i weryfikację TOTP w Supabase Auth przed udostępnieniem panelu flag. PostgreSQL wymaga sesji `aal2` do zmiany flag. Panel pozwala skonfigurować i potwierdzić drugi składnik.
- Ustaw `POLAR_WEBHOOK_SIGNATURE_SECRET` w środowisku serwera, jeśli placówki korzystają z webhooka Polar AccessLink. Serwer weryfikuje podpis zdarzenia przed odczytem powiązania opaski.

### Wspólne rejestry

Odczyt tabel `residents`, `rooms`, `beds` i `bed_assignments` pozostaje objęty izolacją ról i placówek. Z tych samych rejestrów korzystają raporty BI, przydziały i potok głosowy. Te moduły mogą działać niezależnie. Odcinanie wspólnych odczytów po wyłączeniu ewidencji zmieniałoby rzeczywistą liczbę zajętych łóżek w raportach. Zapisy podlegają flagom swojego modułu. Ekrany, API i RPC raportów egzekwują dostępność swojej funkcji niezależnie od dostępu do rejestru.

### Webhook Polar

Webhook dla placówki z wyłączonymi opaskami zwraca wymagane przez AC3 `403`. Polar oczekuje potwierdzenia `200` i dezaktywuje webhook po siedmiu dniach bez udanych dostaw. Wspólny webhook wymaga uwzględnienia tego zachowania przed uruchomieniem integracji. [Dokumentacja Polar AccessLink](https://www.polar.com/accesslink-api/#failure-management)
