# Work Order: CONSENT

## Metadane
- **Wymagania:** `CONSENT-GRANTOR`, `CONSENT-REVOKE`, `CONSENT-LEDGER-IMMUTABLE`
- **Domena:** consent
- **Ryzyko:** HIGH
- **Zależności:** brak (izolacja już gotowa)

## Kontekst
Zgoda dotyczy konkretnego celu z `CONSENT_PURPOSES`. Cofnięcie zgody to dodanie daty cofnięcia (lub nowego rekordu wycofującego), sam rejestr zgód (`consent_ledger`) jest niemodyfikowalny (brak UPDATE, brak DELETE). Prawo do wyrażania zgody ma tylko `resident_self` i `legal_guardian`. `family` nie może wyrażać zgody.

## Cele
1. Utworzyć tabelę `consent_ledger`:
   - `id`, `organization_id`, `resident_id`, `purpose`, `granted_by`, `granted_at`, `revoked_at`.
2. Zabezpieczyć edycję:
   - Żadna z ról nie ma prawa do `UPDATE` / `DELETE` na tabeli `consent_ledger`. Rejestr jest _append-only_.
   - Cofnięcie zgody odbywa się za pomocą dedykowanego mechanizmu RPC `revoke_consent(consent_id)` - logowane w `audit_logs` jako `CONSENT_WITHDRAWN`.
3. Uprawnienia RLS:
   - SELECT dla `org_admin` oraz osób upoważnionych (rodzina).
   - INSERT tylko dla celów zdefiniowanych, udzielać może tylko uprawniona rola (na ten moment zrealizujemy to logiką RLS / RPC).

## Testy
- Próba `UPDATE` lub `DELETE` z `org_admin` jest odrzucana przez RLS/bazę.
- Zgoda na cel spoza `CONSENT_PURPOSES` wyrzuca błąd (check constraint).
- Wywołanie `revoke_consent` poprawnie zamyka zgodę (`revoked_at` lub flaga) i tworzy log `CONSENT_WITHDRAWN`.
