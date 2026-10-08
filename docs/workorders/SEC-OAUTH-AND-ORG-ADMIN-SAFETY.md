# WO: SEC-OAUTH-AND-ORG-ADMIN-SAFETY — Bezpieczeństwo ról w OAuth Callback i przypisywaniu administratora placówki

## Wymagania kontraktowe
- `@REQ: ORG-ISOLATION` — izolacja placówek i ochrona tożsamości użytkowników.
- `@REQ: CONSENT-GRANTOR` — rola rodziny/opiekuna prawnego i izolacja od kont personelu.
- `@REQ: ORG-PROVISION` — bezpieczne przypisywanie administratora placówki.
- `@REQ: SUP-IAM-PANEL` — ochrona przed nieuprawnioną zmianą i degradacją ról systemowych.

## Problem i kontekst

### 1. `SEC-OAUTH-METADATA-OVERWRITE` (`/auth/callback/route.ts`)
Gdy w przeglądarce znajduje się ciasteczko `invite_token` (z procesu zaproszenia bliskiego pensjonariusza), callback Google OAuth (`/auth/callback/route.ts`) bezwarunkowo aktualizuje `app_metadata` zalogowanego użytkownika (`role: relativeRole`, `organization_id: invitation.organization_id`).
Jeżeli użytkownik logujący się przez Google to pracownik placówki (`nurse`, `caregiver`, `doctor`, `staff`) lub administrator (`org_admin`, `super_admin`), tracił on dotychczasową rolę służbową na rzecz roli bliskiego.

**Rozwiązanie:**
- Przed modyfikacją metadanych w `/auth/callback` sprawdzamy aktualną rolę konta w `user.app_metadata?.role` lub `user.user_metadata?.role`.
- Jeżeli konto posiada już rolę inną niż rodzina (tj. `super_admin`, `org_admin`, `nurse`, `caregiver`, `doctor`, `staff`):
  - Blokujemy nadpisanie metadanych (odmowa).
  - Wylogowujemy sesję, kasujemy ciasteczko `invite_token`.
  - Przekierowujemy do `/login` z czytelnym komunikatem o błędzie: *„Konto posiada już uprawnienia personelu placówki lub administratora. Do rejestracji jako bliski użyj dedykowanego konta prywatnego.”*.

### 2. `ORG-ASSIGN-ADMIN-SAFETY` (`actions/organizations.ts`)
W akcji serwerowej `assignAdminToOrganization`:
1. `listUsers()` bez paginacji pobiera jedynie pierwsze 50 kont. Dla użytkowników zarejestrowanych na dalszych stronach funkcja błędnie uznawała, że użytkownik nie istnieje, i próbowała go utworzyć (`createUser`), co kończyło się błędem duplikatu.
2. Gdy użytkownik istniał, jego rola była bezwarunkowo nadpisywana na `org_admin` — w tym konto o roli `super_admin` było bezwzględnie degradowane.

**Rozwiązanie:**
- Implementacja funkcji pomocniczej `findUserByEmail(adminClient, email)` przeszukującej użytkowników z pełną paginacją stron `listUsers({ page, perPage: 50 })`.
- Sprawdzenie roli istniejącego konta:
  - Jeśli konto to `super_admin`: bezwzględna blokada operacji z błędem *„Nie można zmienić roli konta Super Administratora.”*.
  - Jeśli konto posiada już rolę `org_admin` w innej placówce lub aktywną rolę personelu (`nurse`, `caregiver`, `doctor`), blokada z komunikatem wymagającym zmiany uprawnień w IAM.

## Kryteria akceptacji (AC)
1. **AC1 (OAuth Role Protection):** Użytkownik z rolą personelu/admina klikający zaproszenie rodziny nie traci swoich uprawnień — żądanie jest odrzucane z kodem/komunikatem błędu.
2. **AC2 (OAuth Clean Fallback):** Ciasteczko `invite_token` jest usuwane przy odmowie, a sesja jest czyszczona.
3. **AC3 (Assign Admin Pagination):** `assignAdminToOrganization` znajduje użytkownika niezależnie od liczby kont w bazie (pełna paginacja stron).
4. **AC4 (Super Admin Non-Degradation):** Próba przypisania konta `super_admin` jako `org_admin` placówki kończy się odmową i nie modyfikuje jego metadanych.

## Weryfikacja
- Testy logiczne w `tests/logic/auth_and_org_safety.test.ts`.
- Bramka: `bash scripts/verify.sh --full` (6/6 etapów zaliczonych).
