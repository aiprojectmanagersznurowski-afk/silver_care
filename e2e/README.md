# Architektura Testów E2E (Playwright) — Silver Care

Katalog zawiera zestaw testów End-to-End (E2E) dla aplikacji frontendowej Silver Care (`apps/web`), oparty na frameworku Playwright oraz wzorcu Page Object Model (POM).

---

## 1. Struktura Katalogu

```
e2e/
├── fixtures/
│   ├── auth.ts              # Pomocniki autentykacji, mockowania sesji i zapytań Supabase Auth
│   └── base-test.ts         # Rozszerzony test fixture wstrzykujący instancje Page Objects
├── page-objects/            # Page Objects enkapsulujące selektory i akcje na widokach
│   ├── LoginPage.ts         # Strona logowania (/login) z metodą loginAs(role)
│   ├── AcceptInvitePage.ts  # Akceptacja zaproszenia (/accept-invite)
│   ├── UnauthorizedPage.ts  # Ekran braku uprawnień 403 (/unauthorized)
│   ├── FamilyDashboardPage.ts # Pulpit portalu rodziny (/dashboard)
│   ├── StaffBoardPage.ts    # Tablica pensjonariuszy personelu (/staff)
│   └── AdminDashboardPage.ts# Pulpit administratora (/admin, /admin/organizations itp.)
├── roles/                   # Testy UI dla poszczególnych ról użytkowników
│   ├── super-admin.spec.ts  # Rola: super_admin (organizacje, panel IAM, audyt)
│   ├── org-admin.spec.ts    # Rola: org_admin (pulpit placówki, pokoje, pensjonariusze, personel)
│   ├── nurse.spec.ts        # Rola: nurse (tablica opieki, quick-rounds, raporty, agenda)
│   └── family.spec.ts       # Rola: family (raporty, plan dnia, wiadomości, ochrona MDR)
├── auth.spec.ts             # Testy logowania i ochrony sesji (@REQ: SEC-SESSION, SEC-MFA-STAFF)
├── onboarding.spec.ts       # Testy zaproszeń i dołączania (@REQ: ADM-INVITE, FAM-ONBOARDING)
├── family-portal.spec.ts    # Testy portalu rodziny (@REQ: FAM-DASHBOARD, UI-FOUR-STATES)
├── staff-portal.spec.ts     # Testy portalu personelu (@REQ: NUR-BOARD)
├── admin-portal.spec.ts     # Testy portalu administracyjnego (@REQ: ADM-FACILITY-OCCUPANCY, SUP-IAM-PANEL)
├── mdr-compliance.spec.ts   # Testy zgodności z granicą MDR i słownictwa (@REQ: MDR-VOCABULARY)
└── global-setup.ts          # Idempotentne przygotowanie kont testowych przed startem testów
```

---

## 2. Testowanie Scenariuszy Ról (`loginAs`)

Dzięki metodzie `loginPage.loginAs(role)` testowanie nowego scenariusza pod dowolną rolą wymaga tylko jednej linijki:

```typescript
import { test, expect } from './fixtures/base-test';

test.describe('Nowa funkcjonalność pielęgniarska', () => {
  test('@REQ: NUR-BOARD - Pielęgniarka wykonuje nowe zadanie', async ({ loginPage, staffBoardPage, page }) => {
    // Automatyczne logowanie jako rola 'nurse'
    await loginPage.loginAs('nurse');

    // Dalsze akcje w interfejsie...
  });
});
```

Dostępne role w `loginAs(role)`:
- `'super_admin'` — operator platformy Silver Care (kierowany na `/admin/organizations`, ma dostęp do IAM)
- `'org_admin'` — administrator placówki (kierowany na `/admin`, zarządza pokojami, łóżkami i personelem)
- `'nurse'` — pielęgniarka / personel opiekuńczy (kierowany na `/staff`, zarządza notatkami i obchodem)
- `'family'` — członek rodziny (kierowany na `/dashboard`, widzi raport podopiecznego, plan i wiadomości)

---

## 3. Jak dodawać testy dla nowych scenariuszy na froncie (Autonomia)

Za każdym razem, gdy na frontendzie powstaje nowy widok, komponent lub scenariusz biznesowy:

### Krok 1: Utwórz lub zaktualizuj Page Object
W `e2e/page-objects/` stwórz lub rozszerz klasę reprezentującą dany widok (np. `ResidentProfilePage.ts`):
```typescript
import { Page, Locator, expect } from '@playwright/test';

export class ResidentProfilePage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
  }

  async goto(residentId: string) {
    await this.page.goto(`/admin/residents/${residentId}`);
  }
}
```

### Krok 2: Zarejestruj Page Object w Fixture (opcjonalnie)
W `e2e/fixtures/base-test.ts` dodaj obiekt do `TestFixtures`, dzięki czemu będzie on automatycznie dostępny w argumentach funkcji testowej.

### Krok 3: Napisz test z wymaganym znacznikiem `@REQ:`
> **WAŻNE (Bramka Silver Care):** Każdy plik testowy (`.spec.ts`) **musi** zawierać poprawny identyfikator wymagania z `contracts/requirements.contract.mjs` w postaci komentarza `@REQ: <ID>` oraz w nazwie testu:
```typescript
import { test, expect } from './fixtures/base-test';

/**
 * @REQ: ADM-RESIDENT-ADD
 */
test.describe('Profil podopiecznego', () => {
  test('@REQ: ADM-RESIDENT-ADD - Wyświetlenie szczegółów podopiecznego', async ({ page }) => {
    // Implementacja scenariusza
  });
});
```

### Krok 4: Uruchom i zweryfikuj testy
```bash
# Uruchomienie testów E2E
pnpm test:e2e

# Pełna weryfikacja bramki projektu
bash scripts/verify.sh --full
```

---

## 4. Przydatne Polecenia

| Polecenie | Opis |
|---|---|
| `pnpm test:e2e` | Uruchomienie wszystkich testów E2E w trybie headless |
| `pnpm test:e2e:ui` | Interaktywny interfejs Playwright UI |
| `pnpm test:e2e:debug` | Tryb debugowania krok po kroku |
| `pnpm test` | Uruchomienie testów jednostkowych / bazodanowych (Vitest) |
