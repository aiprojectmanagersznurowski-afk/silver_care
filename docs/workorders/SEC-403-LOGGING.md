# Work Order: Logowanie Odmów RLS (SEC-403-LOGGING)

## Metadane
- **Wymagania:** `SEC-403-LOGGING`
- **Domena:** security
- **Ryzyko:** HIGH

## Kontekst
Odmowy dostępu RLS (PostgreSQL nie loguje tego jako audyt aplikacyjny automatycznie, ale my chcemy by nieudane odczyty / modyfikacje były jakoś logowane z poziomu warstwy Edge Function, jednak na poziomie bazy musimy mieć mechanizm zapisu zdarzeń audytowych `ACCESS_DENIED` z kontekstem).

## Cele
1. Zdefiniować typ akcji audytowej dla `ACCESS_DENIED` jeśli jeszcze nie istnieje.
2. Napisać test jednostkowy, w którym symulujemy (zwykłym INSERT INTO audit_logs z API endpointa) serię odmów i sprawdzamy limity lub testujemy API na to, że przy 403 z Supabase, system dopisuje do audit_logs. Ponieważ testujemy tylko warstwę bazy na tę chwilę: stworzyć funkcję bazy `log_access_denied()`.

## Kryteria Akceptacji
- [ ] Funkcja/rpc do logowania prób odmowy (SECURITY DEFINER) pozwala logować `ACCESS_DENIED` jako wpis z UUID, IP itd.
- [ ] Brak PII w tym wpisie (gwarantowane przez poprzednie zabezpieczenie).
