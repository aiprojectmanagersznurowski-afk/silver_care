# Work Order: SECURITY (MFA & Sesje)

## Metadane
- **Wymagania:** `SEC-MFA-STAFF`, `SEC-SESSION`
- **Domena:** security
- **Ryzyko:** HIGH
- **Zależności:** brak bezpośrednich na warstwie bazy; modyfikacje logiki logowania i konfiguracji Supabase.

## Kontekst
Według matrycy ról personel (`super_admin`, `org_admin`, `nurse`) musi posiadać wymuszone logowanie wieloskładnikowe (MFA), natomiast dostęp z ról z rodziny (opiekun prawny, członek rodziny) działa z wykorzystaniem jednego składnika ze względów na użyteczność.
Sesje personelu powinny posiadać timeout (wygasanie po bezczynności).

## Cele
1. **SEC-MFA-STAFF**: Skrypty konfiguracyjne lub wskazówki dla administracji do włączenia AAL2 (Authenticator Assurance Level 2) na żądaniach do bazy. Sprawdzenie w PL/pgSQL funkcji `auth.jwt()` w celu nałożenia RLS zablokowanego tylko dla `aal2` dla personelu.
2. **SEC-SESSION**: Określenie zasad wygasania sesji. 
3. Ponieważ operujemy na schemacie PL/pgSQL i RLS, wymuszenie MFA zrealizujemy przez politykę bazodanową sprawdzającą `auth.jwt() -> 'aal'` (AAL2) dla użytkowników o profilach personelu.

## Granice
- Aplikacja frontendowa będzie odpowiedzialna za interfejs dodawania TOTP, tutaj skupiamy się na rygorach dla Supabase/Postgres.

## Kryteria akceptacji
1. RLS odrzuca zapytania bez wyższego poziomu `aal`, jeżeli autentykujący się użytkownik posiada rolę z listy `MFA_REQUIRED_ROLES` zdefiniowanej w kontrakcie (zrealizowane za pomocą nowej funkcji `enforce_mfa()` używanej globalnie albo per-tabela).
