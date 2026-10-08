# Instrukcja i kolejność scalania PR-ów dla Darka (Merge Cheat Sheet)

Data przygotowania: **08.10.2026**  
Status: Na repozytorium znajduje się **16 otwartych Pull Requestów**, z których wszystkie są w stanie `MERGEABLE` względem gałęzi `main`.

Poniższy przewodnik wyznacza **optymalną, bezkolizyjną kolejność recenzji i scalania (merge)** opartą na dokładnym grafie kolizji zmienianych plików.

---

## 🗺️ Mapa kolizji i struktura klastrów

Z analizy 16 PR-ów wynika podział na 4 grupy:
1. **PR-y całkowicie niezależne (7 PR-ów)** — nie dzielą ani jednego pliku produkcyjnego z innymi otwartymi gałęziami.
2. **Klaster Zaproszeń Rodziny (2 PR-y)** — wspólne pliki w module `family/invite`.
3. **Klaster UI & Nawigacji (3 PR-y)** — sekwencyjne modyfikacje `FamilyHeader` i `UserTable`.
4. **Klaster Auth & Bezpieczeństwa Placówek (3–4 PR-y)** — modyfikacje `auth/callback` i akcji organizacji.

---

## 🚀 Zalecana kolejność scalania (Krok po kroku)

### KROK 1: PR-y całkowicie niezależne (Zero ryzyka konfliktów)
Te PR-y modyfikują odizolowane pliki domenowe. Mogą być recenzowane i scalane natychmiast, w dowolnej kolejności:

| Kolejność | PR | Tytuł | Zmieniane pliki główne |
|---|---|---|---|
| **1.1** | **#67** | `feat(staff): podpięcie powiadomień Sonner w planerze agendy personelu` | `StaffAgendaPlanner.tsx`, testy |
| **1.2** | **#69** | `feat(admin): unifikacja procesu przyjęcia podopiecznego` | `AdmissionWizard.tsx`, testy |
| **1.3** | **#70** | `feat(family): spójność dat i kategorii agendy w portalu rodziny` | `FamilyDashboardClient.tsx`, testy |
| **1.4** | **#71** | `feat(voice): likwidacja blokady braku parametru i nawigacja do /voice` | `SidebarNav.tsx`, `voice/page.tsx`, testy |
| **1.5** | **#72** | `feat(staff): obsługa roli opiekuna (caregiver) w panelu personelu` | `StaffManagementClient.tsx`, testy |
| **1.6** | **#73** | `feat(staff): responsywny widok master-detail skrzynki wiadomości` | `StaffMessagesClient.tsx`, testy |
| **1.7** | **#74** | `feat(admin): uniwersalne pobieranie wzorcowych formatek excel we wszystkich oknach importu` | `FacilityStructureView.tsx`, testy |

```bash
# Szybkie scalenie grupy niezależnej przez GH CLI:
gh pr merge 67 --squash --delete-branch
gh pr merge 69 --squash --delete-branch
gh pr merge 70 --squash --delete-branch
gh pr merge 71 --squash --delete-branch
gh pr merge 72 --squash --delete-branch
gh pr merge 73 --squash --delete-branch
gh pr merge 74 --squash --delete-branch
```

---

### KROK 2: Klaster Zaproszeń Rodziny (Family Invites)
Dotyczy API zaproszeń i dialogu dodawania bliskiego.

- **2.1. PR #64** (`fix(sec): eliminacja ekspozycji tokenu rejestracji rodziny i ochrona logów`)  
  *Dlaczego najpierw:* Usuwa zwracanie `url` z tokenem w JSON oraz wyciek linku do konsoli.
- **2.2. PR #68** (`feat(admin): akcje ponowienia, odwołania i kopiowania w rejestrze zaproszeń`)  
  *Po zmergowaniu #64:* Rozszerza ten sam formularz i rejestr o akcje UI.

```bash
gh pr merge 64 --squash --delete-branch
gh pr merge 68 --squash --delete-branch
```

---

### KROK 3: Klaster UI, Dostępności i IAM
Modyfikacje nagłówka rodziny (`FamilyHeader.tsx`) i tabeli uprawnień (`UserTable.tsx`).

- **3.1. PR #65** (`feat(ui): likwidacja ślepego zaułka i wpięcie nawigacji do profilu`)  
  *Wprowadza:* link do `/settings/profile` w nagłówku rodziny i sidebarze.
- **3.2. PR #66** (`feat(ui): wdrożenie poprawek i dostępności z audytów UI/UX`)  
  *Wprowadza:* poprawki WCAG na logowaniu, paddingi, szerokości kolumn i breakpointy w nagłówku.  
  *(Uwaga: w razie drobnego konfliktu w `FamilyHeader.tsx` wystarczy zachować obie zmiany: link do profilu z #65 + breakpoint `lg:flex` z #66)*.
- **3.3. PR #75** (`feat(iam): uproszczenie tabeli IAM do jednej kolumny Rola z modalem potwierdzenia oraz skrypty DB clean & super-admin`)  
  *Wprowadza:* `ChangeRoleDialog` w `UserTable.tsx` oraz czyszczenie bazy pod 2 Super Adminów.

```bash
gh pr merge 65 --squash --delete-branch
# Przy ewentualnym rebase #66:
git checkout feature/ui-ux-audit-improvements && git pull origin main && git push --force-with-lease
gh pr merge 66 --squash --delete-branch
gh pr merge 75 --squash --delete-branch
```

---

### KROK 4: Klaster Bezpieczeństwa Auth, OAuth & Zarządzania Placówkami

Mamy tutaj dwie alternatywne ścieżki w zależności od preferencji Darka:

#### Opcja A (Rekomendowana — Merge atomowy wg oryginalnych zgłoszeń):
1. **PR #61** (`fix(sec): [SEC-OAUTH-METADATA-OVERWRITE] ochrona app_metadata i autoryzacja zaproszeń OAuth`)
2. **PR #62** (`fix(sec): [ORG-ASSIGN-ADMIN-SAFETY] paginacja listUsers i ochrona ról przy przypisaniu administratora`)
3. **PR #63** (`feat(sec): [OAUTH-GUARDIAN-CONSENTS] wymuszenie zgód Art. 9 RODO i rejestracja w consent_ledger przy Google OAuth`)
4. Po scaleniu #61 i #62: **Zamknięcie PR #76** jako zduplikowanego (ponieważ #76 łączył te dwie poprawki w jedną całość).

```bash
gh pr merge 61 --squash --delete-branch
gh pr merge 62 --squash --delete-branch
gh pr merge 63 --squash --delete-branch
gh pr close 76 --comment "Zakres wdrożony w PR #61 oraz PR #62."
```

#### Opcja B (Alternatywna — Jeśli wolisz scalone poprawki):
1. **PR #76** (zawiera już i testuje razem #61 i #62 w jednym PR).
2. Zamknięcie PR #61 i #62.
3. Rebase i merge **PR #63** na nowy stan `main`.

---

## 📋 Podsumowanie sekwencji w jednym ciągu

```text
[Grupa Niezależna] ➔ #67 ➔ #69 ➔ #70 ➔ #71 ➔ #72 ➔ #73 ➔ #74
[Klaster Invites]  ➔ #64 ➔ #68
[Klaster UI]       ➔ #65 ➔ #66 ➔ #75
[Klaster Auth/Sec] ➔ #61 ➔ #62 ➔ #63 (i zamknięcie #76)
```

Po zakończeniu merge'a:
```bash
git checkout main
git pull origin main
bash scripts/verify.sh --full
```
Bramka 6/6 PASS potwierdzi pełną stabilność połączonego kodu.
