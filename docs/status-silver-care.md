---
project_name: "Silver Care — Backlog"
trello_board_url: "https://trello.com/b/XB1Hig7g"
last_updated: "2026-10-08T13:55:00"
status: "ON_TRACK"
progress_pct: 90
progress_last_week_pct: 3
eta_remaining: "ok. 30h / 4-5 dni roboczych (+ kolejka review PR)"
git_branch: "feat/iam-single-role-modal-confirmation"
requires_user_action: true
daily_history:
  - date: "2026-10-05"
    progress: 87
  - date: "2026-10-08"
    progress: 90
---

## 🎯 Wymagane działania człowieka
- **Review i merge Pull Requestów w kolejce „PR Created / In Review" (Darek / @darkov89):**
  - **PR #75 (Najnowszy):** `feat(iam): uproszczenie tabeli IAM do jednej kolumny Rola z modalem potwierdzenia oraz skrypty DB clean & super-admin` (karta Trello: `6abe6881ede00a60354c64a9`).
  - **PR #57 (Krytyczny):** `fix/impersonation-cookie-binding` (naprawa podglądu placówki przez super admina bez utraty danych pensjonariuszy).
  - **PR #55:** `fix/ui-chart-contrast` (kontrast WCAG 1.4.11 ≥ 3:1).
  - **PR #58:** `docs/groq-dpa-vendor-register` (rejestr podmiotów przetwarzających RODO; tymczasowe DPA TESTXXXX).
  - **PR #59:** `feature/infra-groq-demo-interim` (ADR-015; fallback Groq na czas demo).
  - **PR #56:** `docs/user-stories-ui-series` (specyfikacja narracyjna dla serii UI).
  *(Zgodnie z zasadą INFRA-SDLC-WORKFLOW: autor nie scala własnych PR-ów — merge i przeniesienie do Done należy wyłącznie do recenzenta).*
- **#146 Infra:** konto API Mistral (EU LLM) i zmienna `EU_LLM_API_KEY` na Vercelu (niezbędna do generowania raportów dla bliskich).
- **Karty z listy HUMAN (13):**
  - #152 Pre Prod Audyt.
  - #147 Prezentacja dla KIDO.
  - #149–#151 Cennik i oferta Marconi.
  - Realna referencja umowy DPA Groq (podmiana wartości TESTXXXX w PR #58).
- Wdrożenie produkcyjne i publikacja pierwszych raportów do bliskich.

## 🚧 Blokery i Ryzyka
- **Wąskie gardło Code Review:** 18 kart oczekujących na review i merge przez Darka — kluczowe do odblokowania kolejnych prac.
- **Klucz EU LLM na Vercelu:** Brak `EU_LLM_API_KEY` blokuje pipeline raportów dla bliskich w środowisku produkcyjnym (dostępne jedynie obejście syntetyczne z PR #59).
- **Zgody OAuth dla opiekuna prawnego:** Karta #163 — opiekun realizujący zaproszenie przez Google wymaga ujednolicenia z regulaminem rejestracji hasłem (art. 9 RODO).

## 🛠 Ostatnio zrobione (Changelog — 05.10 – 08.10)
- **Wyczyszczenie bazy danych (`tools/sc-clean-db.mjs`):**
  - Wykonano pełne czyszczenie bazy deweloperskiej z danych testowych: usunięto 19 testowych użytkowników z Supabase Auth, wyczyszczono kaskadowo 23 tabele domenowe (pensjonariusze, łóżka, pokoje, raporty, agenda, audyt).
  - W bazie pozostawiono wyłącznie dwóch Super Adminów: `dariusz.rink@gmail.com` i `ai.projectmanager.sznurowski@gmail.com`.
  - Usunięto również konta seedowe testów E2E (`e2e.*@silvercare.test`).
  - Utworzono narzędzie CLI `tools/sc-set-super-admin.mjs` do bezpiecznego nadawania roli super admina z poziomu `service_role`.
- **Nowy UX w IAM (PR #75):**
  - Odchudzono tabelę IAM: zredukowano dwie kolumny („Aktualna rola” i „Nowa rola”) do pojedynczej kolumny „Rola” z badge'em oraz akcją w wierszu „Zmień rolę”.
  - Zaimplementowano dedykowany modal potwierdzenia (`ChangeRoleDialog`) z jawnym pytaniem o zmianę uprawnień oraz blokadą przycisku „Potwierdź” przed pomyłkowym zapisem.
  - Zachowano ochronę eskalacji uprawnień (`SEC-IAM-HARDENING` AC2) — wykluczono rolę `super_admin` z UI.
- **Przekazanie SDLC karty Trello #148 (`6abe6881ede00a60354c64a9`):**
  - Karta przeniesiona do listy `PR Created / In Review` i przypisana do Darka (`@darkov89`).
- **Przebudowa UI na szablonie shadcn-admin (PR #51–#54 zmergowane do main):**
  - Kompletny refactoring paneli: Administratora, Personelu, Portalu Bliskich i Logowania.
- **Weryfikacja jakościowa:**
  - Pełna bramka `bash scripts/verify.sh --full` zaliczona: **6/6 ETAPÓW ZIELONYCH (100% PASS)**.
- **Stan Trello (08.10.2026):**
  - Done: **109 kart** (wzrost z 87)
  - PR Created / In Review: **18 kart**
  - HUMAN: **13 kart**

## 📋 Rekomendowana sekwencja zadań w Trello (Next Up)
1. **[PR #75 & PR #57]** Code Review i merge przez Darka (karty IAM UX, DB Clean i Impersonation Cookie Binding).
2. **[#167 & #168]** Poprawki bezpieczeństwa z audytu: zabezpieczenie `auth/callback` przed nadpisaniem roli personelu oraz paginacja w przypisywaniu admina placówki.
3. **[#152]** Pre Prod Audyt — po scaleniu bieżących PR-ów.

## 💡 Ważne decyzje / Uwagi architektoniczne
- **Bezpieczeństwo roli super_admin:** Zgodnie z ADR i regułą `SEC-IAM-HARDENING`, uprawnienia super admina nie są dostępne w interfejsie webowym ani w server actions. Zarządzanie tą rolą odbywa się wyłącznie poprzez dedykowany skrypt CLI `node tools/sc-set-super-admin.mjs` lub bezpośrednio w panelu Supabase.
- **Dwufazowe potwierdzenie w IAM:** Modal `ChangeRoleDialog` eliminuje ryzyko przypadkowej zmiany uprawnień personelu/rodziny jednym kliknięciem w tabeli, jednocześnie upraszczając layout i oszczędzając przestrzeń ekranową.
