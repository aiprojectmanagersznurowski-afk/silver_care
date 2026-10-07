# Work Order: Wymuszenie zgód i regulaminu przy Google OAuth dla opiekuna prawnego (OAUTH-GUARDIAN-CONSENTS)

## Metadane
- **Wymagania:** `CONSENT-GRANTOR`, `ADM-INVITE`, `FAM-ONBOARDING`
- **Karta Trello:** #163 (`DECYZJA: zgody i regulamin przy logowaniu Google OAuth (opiekun prawny)`)
- **Domena:** consent / auth
- **Ryzyko:** HIGH
- **Zależności:** `CONSENT-GRANTOR`, `ADM-INVITE`

## Kontekst
Zgodnie z art. 9 RODO oraz regułą architektoniczną `CONSENT-GRANTOR`, przetwarzanie danych o zdrowiu pensjonariusza wymaga aktywnej i udokumentowanej zgody pensjonariusza lub jego opiekuna prawnego (`legal_guardian`).
W rejestracji tradycyjnej hasłem (`/register`) opiekun prawny ma obowiązek zaakceptować regulamin i oświadczenia, co skutkuje zapisem celów przetwarzania w `consent_ledger`.
W dotychczasowej ścieżce rejestracji przez Google OAuth (`/auth/callback`):
1. Przycisk „Zarejestruj się przez Google” na stronie `/register` nie blokował kliknięcia bez zaznaczenia checkboxów zgód.
2. Callback OAuth nadawał rolę `legal_guardian` bez weryfikacji zgód i bez zapisu do niezmiennego rejestru `consent_ledger`.

## Cele i Kryteria Akceptacji
1. [ ] **Blokada w UI `/register`:** Przycisk „Zarejestruj się przez Google” jest zablokowany, dopóki użytkownik nie zaakceptuje wymaganych oświadczeń (`!consentsValid`). Po kliknięciu ustawia ciasteczko `invite_consents_accepted=true`.
2. [ ] **Weryfikacja zgód w logice autoryzacji (`evaluateOAuthInviteClaim`):**
   - Dodanie pola `consentsAccepted?: boolean` do `OAuthInviteClaimInput`.
   - Jeśli zaproszenie nadaje status `legal_guardian` (nowe przypisanie lub awans roli), brak zgód kończy się odmową `CONSENTS_REQUIRED`.
   - Zwrócenie flagi `requiresConsentLedgerInsert: boolean` informującej o konieczności zapisu do `consent_ledger`.
3. [ ] **Integracja w `/auth/callback`:**
   - Przekierowanie do `/register?token=...` z komunikatem o konieczności akceptacji zgód, gdy próba realizacji roli `legal_guardian` następuje bez zgód.
   - Zapis celów przetwarzania (`wellness_data_ingest`, `family_view_basic`) do `consent_ledger` z `granted_by: 'legal_guardian'`.
   - Zapis do `audit_logs` zdarzenia `FAMILY_ACCOUNT_ACTIVATED` bez PII.
   - Usunięcie ciasteczka `invite_consents_accepted`.

## Fazy
- **RED:** `tests/logic/oauth_guardian_consents.test.ts` weryfikujący wymóg zgód dla opiekuna prawnego w OAuth i zapis w `consent_ledger`.
- **GREEN:** Wdrożenie logiki w `apps/web/src/lib/invite-authorization.ts`, `apps/web/src/app/auth/callback/route.ts` oraz `apps/web/src/app/register/page.tsx`.
- **VERIFY:** Pełna bramka testowa `bash scripts/verify.sh --full` i `pnpm build`.
