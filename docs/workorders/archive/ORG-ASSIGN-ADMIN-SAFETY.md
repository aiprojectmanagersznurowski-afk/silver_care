# Work Order: Bezpieczne przypisanie administratora placówki i paginacja użytkowników (ORG-ASSIGN-ADMIN-SAFETY)

## Metadane
- **Wymagania:** `ORG-PROVISION`, `SUP-IAM-PANEL`, `ORG-ISOLATION`
- **Karta Trello:** #168 (`ORG-ASSIGN-ADMIN-SAFETY: przypisanie administratora nadpisuje rolę istniejącego konta i szuka go bez paginacji`)
- **Domena:** tenancy / auth
- **Ryzyko:** HIGH
- **Zależności:** `ORG-PROVISION`, `SUP-IAM-PANEL`

## Kontekst
W `apps/web/src/actions/organizations.ts` funkcja `addAdminToOrganizationAction`:
1. **Brak paginacji przy wyszukiwaniu:** `adminClient.auth.admin.listUsers()` bez parametrów pobiera tylko 1. stronę (domyślny limit 50 kont w Supabase Auth). Przy bazie powyżej 50 użytkowników, istniejące konta z kolejnych stron nie są odnajdywane, co powoduje próbę ich ponownego utworzenia (`createUser`) i błąd duplikatu emaila.
2. **Bezwarunkowe nadpisanie roli i placówki:** W przypadku znalezienia użytkownika, funkcja bez sprawdzenia dotychczasowych uprawnień nadpisuje `role: 'org_admin'` oraz `organization_id: orgId`. 
   - W przypadku operatora platformy (`super_admin`) prowadzi to do utraty uprawnień globalnych (degradacja do `org_admin`).
   - W przypadku administratora innej placówki prowadzi to do cichego przejęcia konta i naruszenia izolacji najemców (`ORG-ISOLATION`).

## Cele i Kryteria Akceptacji
1. [ ] **Paginowane wyszukiwanie użytkownika po e-mailu (`findUserByEmail`):**
   - Funkcja przeszukuje strony `listUsers({ page, perPage })` do momentu odnalezienia użytkownika lub wyczerpania stron.
   - Wyszukiwanie jest odporne na wielkość liter i białe znaki (`trim().toLowerCase()`).
2. [ ] **Walidacja bezpieczeństwa przypisania roli (`evaluateAdminAssignment`):**
   - Odrzucenie przypisania (`SUPER_ADMIN_CONFLICT`), gdy istniejący użytkownik posiada rolę `super_admin`.
   - Odrzucenie przypisania (`ORGANIZATION_MISMATCH`), gdy istniejący użytkownik posiada przypisaną inną placówkę niż docelowa.
   - Zezwolenie na przypisanie dla nowego konta (`isExistingUser: false`) lub konta bez ról / w tej samej placówce.
3. [ ] **Wdrożenie w `addAdminToOrganizationAction`:**
   - Wykorzystanie paginowanego wyszukiwania oraz reguł `evaluateAdminAssignment`.
   - Zwrócenie jednoznacznego komunikatu błędu w przypadku konfliktu ról lub placówki.

## Fazy
- **RED:** Test jednostkowy `tests/logic/org_admin_assign_safety.test.ts` weryfikujący wszystkie kryteria akceptacji.
- **GREEN:** Implementacja modułu w `apps/web/src/lib/admin-assign-safety.ts` i integracja w `apps/web/src/actions/organizations.ts`.
- **VERIFY:** Pełna bramka testowa `bash scripts/verify.sh --full` i `pnpm build`.
