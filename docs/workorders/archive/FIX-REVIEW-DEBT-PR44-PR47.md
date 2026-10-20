# Work Order: Domknięcie uwag z review PR #44 i PR #47 (FIX-REVIEW-DEBT-PR44-PR47)

## Metadane
- **Wymagania:** `CONSENT-GRANTOR`, `ORG-ISOLATION`, `ADM-INVITE`, `FAM-MESSAGES`, `UI-ACCESSIBILITY`
- **Źródło:** review @darkov89 — PR #44 (CHANGES_REQUESTED 2026-10-01, punkty 1–2) i PR #47 (CHANGES_REQUESTED 2026-10-02, punkty 2–3). Oba PR-y zostały zatwierdzone po rebase, ale poprawki merytoryczne nie trafiły do `main`.
- **Domena:** residents / consent / tenancy / presentation
- **Ryzyko:** HIGH (rola z prawem do zgód art. 9 RODO, izolacja placówek)
- **Zmiana kontraktu:** nie — wszystkie kryteria mieszczą się w istniejących wymaganiach.
- **Powiązania:**
  - `apps/web/src/app/auth/callback/route.ts`
  - `apps/web/src/app/api/family/invite/route.ts`
  - `apps/web/src/lib/onboarding.ts`
  - `apps/web/src/lib/invite-authorization.ts` (nowy)
  - `apps/web/src/components/StaffBoardClient.tsx`
  - `apps/web/src/app/(staff)/staff/reports/page.tsx`
  - `apps/web/src/app/(staff)/voice/page.tsx`
  - `tests/logic/staff_messages.test.ts`

---

## Kryteria Akceptacji (Given-When-Then)

### AC1: Opiekun prawny zachowuje rolę przy logowaniu Google OAuth (`CONSENT-GRANTOR`)
- **GIVEN** zaproszenie z rolą `legal_guardian`.
- **WHEN** zaproszony realizuje je przez `/auth/callback` (Google OAuth).
- **THEN** `app_metadata.role` oraz `resident_relative_links.role` / `relationship_code` to `legal_guardian`, tak samo jak w `POST /api/family/register`.
- **AND** każda inna lub pusta wartość roli w zaproszeniu daje `family` (nigdy rolę wyższą).

### AC2: Zaproszenie nie przekracza granicy placówki (`ORG-ISOLATION`, `ADM-INVITE`)
- **GIVEN** `org_admin` placówki A.
- **WHEN** wysyła `POST /api/family/invite` z `resident_id` pensjonariusza placówki B albo nieistniejącym.
- **THEN** odpowiedź 404, zaproszenie nie powstaje. Ta sama odpowiedź dla „nie istnieje" i „obca placówka" — brak wyroczni istnienia.
- **AND** `organization_id` zaproszenia zawsze pochodzi z pensjonariusza zweryfikowanego wobec tokenu; `super_admin` bez przypisanej placówki dziedziczy placówkę pensjonariusza.

### AC3: Test skrzynki wiadomości weryfikuje kod produkcyjny (`FAM-MESSAGES`)
- **GIVEN** `tests/logic/staff_messages.test.ts`.
- **THEN** `groupMessagesIntoThreads` i `filterThreadsBySearch` są importowane z `apps/web/src/lib/messages-helper.ts`, a nie kopiowane do testu.

### AC4: Brak `<button>` zagnieżdżonego w `<Link>` (`UI-ACCESSIBILITY`)
- **GIVEN** dowolny komponent w `apps/web/src`.
- **THEN** żaden `<Link>` nie zawiera bezpośrednio `<button>` (nieprawidłowy HTML, ostrzeżenie `validateDOMNesting`, podwójny element fokusowalny dla czytnika ekranu).
- **AND** na tablicy personelu akcja „Wiadomości od rodziny" jest linkiem do `/staff/messages?residentId=<UUID>` z celem dotykowym min. 44px.

---

## Granice
- Nie zmieniamy kontraktu, schematu ani migracji.
- Brak zmian w słownictwie widocznym dla użytkownika.
- Wygląd przycisków-linków pozostaje bez zmian (te same klasy przeniesione na `<Link>`).

## Komendy
```bash
node tools/sc-phase.mjs red
node tools/sc-phase.mjs green
bash scripts/verify.sh --full
pnpm test:e2e e2e/roles/nurse-messages.spec.ts
```
