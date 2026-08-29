# Work Order: Polityka retencji (SEC-RETENTION)

## Metadane
- **Wymagania:** `SEC-RETENTION`
- **Domena:** security
- **Ryzyko:** MEDIUM

## Kontekst
System ma zautomatyzowaną politykę retencji danych archiwalnych. Twarde usuwanie (`hard_delete_resident`) zajmuje się logami ręcznie usuwanych mieszkańców, ale potrzebne jest zadanie bazy (bądź wywołanie RPC, które uruchomi background worker lub cron z Supabase pg_cron), które usunie rekordy w `audit_logs` po upływie okresu retencji, ewentualnie zostawiając zanonimizowany ślad. 

## Cele
1. Utworzyć bazodanową funkcję `enforce_retention_policy()` jako zadanie bazy danych, która zredaguje lub usunie przeterminowane rekordy (np. starsze niż x lat - na potrzeby testu zrobimy wywołanie parametryzowane, żeby łatwo można było użyć w testach).
2. Rozbudować testy jednostkowe `archive.test.ts` (lub podobne).

## Kryteria Akceptacji
- [ ] Funkcja retencyjna znajduje wpisy przeterminowane i poprawnie czyści dane.
- [ ] Zabezpieczenie przed edycją w audit_logs dopuszcza to czyszczenie.
