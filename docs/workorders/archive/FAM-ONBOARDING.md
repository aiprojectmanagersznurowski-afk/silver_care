# WO: FAM-ONBOARDING — Onboarding Bliskiego i Opiekuna Prawnego

## Wymaganie
Bliski zakłada konto z zaproszenia i akceptuje zgody.
Z kontraktu: `R('FAM-ONBOARDING', { source: 'SC-FAM-01', domain: 'family', statement: 'Bliski zakłada konto z zaproszenia i akceptuje zgody.', acceptance: ['Wygasły lub unieważniony token pokazuje czytelny komunikat', 'Po rejestracji powstaje powiązanie z rolą ustaloną przez administratora', 'Akceptacja regulaminu i zgód jest warunkiem aktywacji konta'], risk: 'MEDIUM' })`

## Kontekst kodu i powiązania
- **Kontrakt**: `contracts/requirements.contract.mjs` (`FAM-ONBOARDING`, `CONSENT-GRANTOR`, `UI-FOUR-STATES`, `ADM-INVITE`).
- **Tabela zaproszeń**: `public.resident_invitations` (kolumny `id`, `organization_id`, `resident_id`, `role`, `email`, `expires_at`, `revoked_at`, `claimed_at`).
- **Tabela relacji**: `public.resident_relative_links` (`resident_id`, `relative_user_id`, `relationship_code`, `role`).
- **Tabela zgód**: `public.consent_ledger` (`organization_id`, `resident_id`, `purpose`, `granted_by`, `granted_at`, `revoked_at`). Zgodnie z `CONSENT-GRANTOR` i ograniczeniem bazy danych `valid_grantor CHECK (granted_by IN ('resident_self', 'legal_guardian'))`, zgody na przetwarzanie danych zdrowotnych może udzielić wyłącznie `resident_self` lub `legal_guardian`. Rola `family` nie ma uprawnień do wyrażania ani odwoływania zgód Art. 9 RODO.
- **Prezentacja i MDR**: Brak jakichkolwiek wystąpień słowa „pacjent” (zastąpione przez „podopieczny” / „bliski” / „senior”).
- **4 stany interfejsu (UI-FOUR-STATES)**: Strona rejestracji `/register` musi obsługiwać stany `loading` (weryfikacja tokena), `error` (unieważniony/wygasły/wykorzystany/błędny token), `form` (wypełnianie hasła i zgód) oraz `success` (potwierdzenie aktywacji i przejście do logowania).

## Kryteria akceptacji
1. **Weryfikacja tokena i obsługa błędów (AC1 - UI-FOUR-STATES)**:
   - Wygasły (`expires_at < now()`), odwołany (`revoked_at IS NOT NULL`), zrealizowany (`claimed_at IS NOT NULL`) lub nieistniejący token wyświetla dedykowany, czytelny komunikat błędu z wyjaśnieniem sytuacji i informacją o konieczności kontaktu z placówką.
   - Prawidłowy token udostępnia formularz z zablokowanym adresem e-mail oraz informacją o przyznanej roli (`Bliski` lub `Opiekun prawny`), bez ujawniania danych osobowych pensjonariusza przed rejestracją.
2. **Powiązanie z rolą ustaloną przez administratora (AC2)**:
   - Po rejestracji użytkownik otrzymuje w `auth.users.app_metadata.role` rolę zapisaną w zaproszeniu (`invitation.role`: `family` lub `legal_guardian`).
   - W tabeli `resident_relative_links` tworzony jest wpis z identyczną rolą `role` i odpowiednim `relationship_code`.
   - Zaproszenie zostaje oznaczone jako zużyte (`claimed_at = now()`), co uniemożliwia ponowne wykorzystanie tokena.
3. **Akceptacja regulaminu i rejestracja zgód (AC3 - CONSENT-GRANTOR)**:
   - Akceptacja regulaminu i oświadczeń jest bezwzględnym warunkiem utworzenia konta.
   - Jeśli zaproszona osoba posiada rolę `legal_guardian`, w procesie rejestracji zapisywana jest zgoda w `public.consent_ledger` dla `wellness_data_ingest` i `family_view_basic` z oznaczeniem `granted_by: 'legal_guardian'`.
   - Dla roli `family` konto nie rejestruje zgód Art. 9 RODO w `consent_ledger`.
4. **Rejestr audytowy i ochrona danych (AC4 - SEC-NO-PII-LOGS)**:
   - Rejestracja tworzy wpis audytowy w `audit_logs` (`action = 'FAMILY_ACCOUNT_ACTIVATED'`) zawierający wyłącznie identyfikatory techniczne (UUID), bez PII.

## Weryfikacja
- Testy logiki biznesowej: `tests/logic/fam_onboarding.test.ts` (`@REQ: FAM-ONBOARDING`).
- Testy bazodanowe i integralności: `tests/db/fam_onboarding.test.ts` (`@REQ: FAM-ONBOARDING`).
- Bramka weryfikacyjna: `bash scripts/verify.sh --full` (100% PASS).
- Kompilacja frontendu: `pnpm --filter web build`.
