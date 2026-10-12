# Work Order: Ochrona app_metadata kont przed nadpisaniem przy OAuth (SEC-OAUTH-METADATA-OVERWRITE)

## Metadane
- **Wymagania:** `CONSENT-GRANTOR`, `ORG-ISOLATION`, `ADM-INVITE`
- **Karta Trello:** #167
- **Domena:** security / auth
- **Ryzyko:** HIGH
- **Zależności:** `ADM-INVITE`, `CONSENT-GRANTOR`, `ORG-ISOLATION`

## Kontekst
W `apps/web/src/app/auth/callback/route.ts` podczas realizacji zaproszenia dla bliskiego przez Google OAuth (`/auth/callback` z ciasteczkiem `invite_token`), kod bezwarunkowo nadpisywał `app_metadata` (`role`, `organization_id`) użytkownika rolą z zaproszenia. 

Stwarzało to następujące zagrożenia bezpieczeństwa i spójności danych:
1. **Utrata uprawnień personelu (Account Takeover / Privilege Loss):** Zalogowane konto personelu lub administratora (`super_admin`, `org_admin`, `nurse`, `admin`, itp.) po kliknięciu linku zaproszenia dla bliskich i zalogowaniu przez Google traciło swoje uprawnienia personelu na rzecz roli `family` lub `legal_guardian`.
2. **Naruszenie izolacji placówek (ORG-ISOLATION):** Konto powiązane z placówką A mogło przez zaproszenie z placówki B nadpisać `organization_id` na placówkę B.
3. **Degradacja uprawnień opiekuna prawnego (CONSENT-GRANTOR):** Użytkownik posiadający status opiekuna prawnego (`legal_guardian`) w placówce A przy realizacji drugiego zaproszenia (np. z rolą `family` dla innego krewnego) był degradowany do zwykłej roli `family`, tracąc uprawnienia z art. 9 RODO.

## Cele i Kryteria Akceptacji
1. [x] Wydzielenie czystej logiki autoryzacji realizacji zaproszenia do `evaluateOAuthInviteClaim` w `apps/web/src/lib/invite-authorization.ts`.
2. [x] Fail-closed: odrzucenie realizacji zaproszenia z błędem `STAFF_ROLE_CONFLICT`, jeśli użytkownik posiada jakąkolwiek rolę personelu lub administratora.
3. [x] Izolacja placówek: odrzucenie z błędem `ORGANIZATION_MISMATCH`, jeśli użytkownik posiada już przypisaną inną placówkę.
4. [x] Przypisanie nowej roli dla użytkownika bez ról (`isNewRoleAssignment: true`).
5. [x] Zachowanie roli `legal_guardian` (brak degradacji do `family`, `isNewRoleAssignment: false`).
6. [x] Awans z roli `family` do `legal_guardian`, gdy nowe zaproszenie nadaje status opiekuna prawnego (`isNewRoleAssignment: true`).
7. [x] Wpięcie walidacji do `apps/web/src/app/auth/callback/route.ts` i aktualizacja `app_metadata` wyłącznie przy `isNewRoleAssignment === true`.

## Fazy
- **RED:** `tests/logic/oauth_invite_claim.test.ts` (6 testów weryfikujących wszystkie scenariusze i brak surowego nadpisywania w trasie callback).
- **GREEN:** Implementacja `evaluateOAuthInviteClaim` w `apps/web/src/lib/invite-authorization.ts` oraz integracja w `apps/web/src/app/auth/callback/route.ts`.
- **VERIFY:** Pełna bramka testowa i weryfikacja bezpieczeństwa.
