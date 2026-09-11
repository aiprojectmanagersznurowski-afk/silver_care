# Silver Care — Uniwersalny Master Prompt (End-to-End Autonomous Execution)

> **Wersja**: 3.0 (Trello Integration · Figma Alignment · Auto Storybook & CI) · **Data**: 2026-09-11  
> **Właściciele**: Darek Rink, Michał Sznurowski  
> **Środowisko**: Antigravity / Cursor / Claude Code (Narzędziowo Agnostyczny)  
> **Podział modeli**: Kodowanie w **Gemini**, weryfikacja i audyt w **Claude Opus** („praca na cztery ręce”)

---

## 0. INSTRUKCJA OPERACYJNA DLA AGENTA

Działasz w trybie **CIĄGŁEJ, AUTONOMICZNEJ EGZEKUCJI (END-TO-END EXECUTION)**.
Przekształcasz zadania z Trello w gotową, w pełni przetestowaną, zaudytowaną i wypchniętą na feature branch funkcjonalność.

### 0.1. Zasady Pobierania Zadań z Trello (Strict Assignment Filter)
Zadania pobierasz z tablicy **Trello Backlog**. Obowiązuje **twarde filtrowanie przypisania**:
- **Dla sesji Darka**: Pobierasz **WYŁĄCZNIE** karty przypisane do **Darka** (`@darek` / Darek Rink).
- **Dla sesji Michała**: Pobierasz **WYŁĄCZNIE** karty przypisane do **Michała** (`@michal` / Michał Sznurowski).
- **ZAKAZ**: Pod żadnym pozorem **NIE wykonujesz zadań nieprzypisanych** ani zadań przypisanych do drugiej osoby.
- Karta z Trello wyznacza REQ-ID, zakres oraz kryteria akceptacji.

### 0.2. Autonomia i Granice Człowieka
- **Start**: Automatyczny `git pull` w celu synchronizacji kodu i migracji bazy.
- **W trakcie**: Zero pytań o wybory techniczne, zależności, nazewnictwo czy okna kontraktowe.
- **Koniec**: Automatyczny commit, push do feature brancha oraz **automatyczna aktualizacja karty Trello**.
- **Jedyny punkt wejścia człowieka (Human-in-the-loop)**: **Ostateczny merge Pull Requesta do gałęzi głównej (`main`)** oraz wdrożenie produkcyjne.

---

## 1. TOŻSAMOŚĆ I GRANICE PRAWNE PRODUKTU (MDR & RODO)

Silver Care to **narzędzie komunikacji i organizacji codziennego życia placówki opiekuńczej**.
**NIE jest wyrobem medycznym (MDR), systemem ratunkowym ani monitoringiem stanu zdrowia.**

### 1.1. Granica Prezentacji (MDR — ADR-004, ADR-005)
- **Bliscy widzą wyłącznie metryki behawioralne**: liczba kroków (`steps_total`), czas aktywności (`active_minutes`), długość snu (`sleep_duration_min`), godziny snu (`sleep_start_time`, `sleep_end_time`).
- **Bliscy NIGDY nie widzą parametrów fizjologicznych**: tętna (`heart_rate_bpm`, min/max/avg/resting), HRV (`hrv_ms`), oddechu, wyniku snu (`sleep_score`), regeneracji. Dane te mogą być zbierane dla personelu — **bezwzględny zakaz dotyczy ich prezentacji bliskim**.
- **System nie ocenia stanu zdrowia i nie prognozuje**: Wolno napisać: *„Brak aktywności od czterech godzin”*. Zakazane: *„Podejrzenie omdlenia / pogorszenie stanu”*.
- **Żadna metryka nie wyzwala powiadomienia alarmowego**: Jedynym wyzwalaczem powiadomienia dla bliskich jest **publikacja raportu dziennego zatwierdzonego przez personel**.
- **Słownictwo (MDR-VOCABULARY)**: Słowo **„pacjent”** (oraz odmiany: „o pacjencie”, „pacjenci”) jest **bezwzględnie zakazane** w warstwie widocznej dla użytkownika. Stosuj: **podopieczny**, **senior**, **pensjonariusz**. Zamiast „diagnoza”/„objaw”/„terapia” stosuj: **obserwacja**, **aktywność**, **zajęcia**.

### 1.2. Dane Szczególnej Kategorii (Art. 9 RODO & Bezpieczeństwo)
- **Zgodę na przetwarzanie danych zdrowotnych** może wyrazić **wyłącznie** pensjonariusz (`resident_self`) lub jego **opiekun prawny** (`legal_guardian`). Rola `family` (krewny) **nie może** wyrażać ani cofać zgód.
- **Rejestr zgód (`consent_ledger`) i rejestr audytowy (`audit_logs`) są NIEZMIENIALNE (append-only)**: Zakaz `UPDATE` i `DELETE`. Cofnięcie zgody to wstawienie nowego stanu z `revoked_at`.
- **Zero danych osobowych (PII) w logach i powiadomieniach**: Logujemy wyłącznie UUID i kody błędów. Nigdy imion, notatek ani danych wrażliwych.
- **PESEL wyłącznie jako hash z solą (`pesel_hash`)**: Brak wartości jawnej w bazie, logach i tokenach.
- **Klucz `service_role` omija RLS**: Bezwzględny zakaz umieszczania go w kodzie klienta (frontendu).

---

## 2. REGUŁA NADRZĘDNA — KONTRAKTY (W PEŁNI AUTOMATYCZNE ZARZĄDZANIE)

**Kontrakt w `contracts/*.contract.mjs` jest jedynym źródłem prawdy.**
Kod importuje z `@silvercare/contracts`, nigdy nie przepisuje wartości na sztywno.

Gdy zadanie wymaga dodania lub zmiany ról, uprawnień, tabel, widoków, powiadomień lub kryteriów wymagań:
1. **Automatyczne otwarcie okna**:
   ```bash
   node tools/sc-contract-window.mjs open <REQ-ID>
   ```
2. **Aktualizacja odpowiednich kontraktów** w `contracts/*.contract.mjs`.
3. **Automatyczne uruchomienie potoku generowania i weryfikacji**:
   ```bash
   node tools/sc-codegen.mjs && node tools/sc-validate.mjs && node tools/sc-selftest.mjs
   ```
4. **Automatyczne zamknięcie okna**:
   ```bash
   node tools/sc-contract-window.mjs close
   ```
*Agent wykonuje ten łańcuch w całości sam, nie czeka na potwierdzenie od użytkownika.*

---

## 3. UI AGENT: FIGMA & STORYBOOK INTEGRATION

Przy każdym zadaniu obejmującym warstwę wizualną (frontend / UI) oraz podczas pisania testów UI:
1. **Automatyczna inspekcja makiet Figma**:
   - Sprawdź katalogi makiet: `Figma-personel-portal/` (portal personelu) oraz `figma-family-portal/` (portal rodziny).
   - Dopasuj implementowane widoki do układu, siatki, proporcji i hierarchy z Figma.
2. **System Projektowy Apple Minimalist (ADR-011)**:
   - Używaj zmiennych CSS wygenerowanych z kontraktu do `packages/contracts/src/generated/tokens.css`.
   - Tekst bazowy: **17px**, min. kontrast: **4.5:1**, target dotykowy: **48px**, kolumna raportu: max **680px**.
   - Zakaz używania kolorów (zielony/czerwony) jako oceny stanu zdrowia seniora.
3. **Wymóg 4 Stanów Komponentu (`UI-FOUR-STATES`) w Storybooku**:
   - Każdy komponent prezentujący dane musi posiadać stories w `.storybook/` demonstrujące 4 stany:
     1. **Loading** (szkielet UI / animacja pulsowania, nie spinner),
     2. **Empty** (stan pusty z jasną informacją, kiedy pojawią się dane),
     3. **Success** (prezentacja danych z zachowaniem granic MDR),
     4. **Error** (komunikat błędu z opcją ponowienia).

---

## 4. AUTONOMICZNY DOBÓR I INSTALACJA ZALEŻNOŚCI

Jeśli do implementacji brakuje biblioteki pomocniczej:
1. **Autonomiczny wybór**: Dobierz najlepsze, nowoczesne, stabilne i lekkie rozwiązanie z ekosystemu JavaScript/TypeScript/React.
2. **Weryfikacja bezpieczeństwa (Security & Vulnerabilities)**:
   - Sprawdź podatności pakietu przed instalacją.
   - Po instalacji uruchom weryfikację bezpieczeństwa:
     ```bash
     pnpm audit --prod
     ```
   - Jeśli pakiet wnosi krytyczne podatności — natychmiast go odrzuć i wybierz bezpieczną alternatywę.
3. **Instalacja**: Zainstaluj przez `pnpm add <pakiet>` (lub `-D` dla narzędzi deweloperskich).
4. **Odnotowanie**: Zapisz wybór i uzasadnienie w sekcji decyzji autonomicznych (`[AUTO_LOGGED]`).

---

## 5. PODZIAŁ MODELI: GEMINI + CLAUDE OPUS („PRACA NA CZTERY RĘCE”)

W środowisku Antigravity stosujemy rygorystyczny podział odpowiedzialności:
- **Generowanie kodu, refaktoryzacja, testy jednostkowe, UI**: Model **Gemini** (szybka, precyzyjna, kontekstowa implementacja).
- **Weryfikacja, Audyt Bezpieczeństwa, Granice MDR i RLS**: Model **Claude Opus** (niezależny audytor w fazie REVIEW — subagenci `reviewer`, `rls-security-auditor`, `privacy-auditor`).
- Żaden kod nie trafia do feature brancha bez weryfikacji modelu audytującego.

---

## 6. WSPÓŁDZIELONA BAZA DANYCH (DAREK + MICHAŁ)

Pracujemy na **wspólnej instancji bazy danych Supabase**:
1. **Automatyczny `git pull` przed startem**: Zanim cokolwiek zaplanujesz, wykonaj `git pull` i sprawdź `supabase/migrations/` pod kątem nowych migracji dodanych przez drugiego dewelopera.
2. **Migracje wyłącznie przyrostowe**:
   - Każda zmiana schematu to nowy plik: `supabase/migrations/YYYYMMDDHHMMSS_<nazwa>.sql`.
   - **NIGDY nie modyfikuj ani nie usuwaj istniejących plików migracji**. Zmiany wprowadza się nową migracją korygującą.
   - Migracje muszą być idempotentne (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
3. **Natychmiastowa publikacja**: Po utworzeniu pliku migracji natychmiast commituj i wypychaj go na branch, aby zminimalizować okno kolizji.

---

## 7. AUTONOMICZNY SILNIK DECYZJI (SELF-ANSWERING ENGINE)

Wszystkie dylematy techniczne rozstrzygaj według tabeli **DEFAULTS** (`contracts/autonomy.contract.mjs`):

| Obszar | Domyślne rozstrzygnięcie | Uzasadnienie |
|---|---|---|
| **Obsługa błędów** | **Fail closed** | Przy danych art. 9 brak dostępu w razie wątpliwości. |
| **Stan pusty UI** | **4 stany (NFR-UI-01)** | Loading (szkielet), empty (z informacją kiedy dane), success, error. |
| **Brak danych z opaski** | **Pomiń sekcję** | Zamiast pokazywać 0 (0 kroków sugeruje brak ruchu, a może być brakiem synchronizacji). |
| **Język** | **Polski w UI, Angielski w kodzie** | Nazwy tabel, kolumn, funkcji i typów wyłącznie po angielsku. |
| **Identyfikatory** | **UUID v7** | Sortowalne czasowo, bez ujawniania sekwencji liczbowych. |
| **Paginacja** | **Kursorowa (keyset)** | Stabilna przy dopisywaniu wierszy w czasie rzeczywistym. |
| **Format daty** | **Polski, słowny miesiąc** | Np. „14 sierpnia 2026” — czytelny dla seniorów i rodzin. |
| **Strefa czasowa** | **Europe/Warsaw** | Jedna strefa dla wszystkich placówek w Polsce. |
| **Komponenty** | **Server Components domyślnie** | Client Components (`'use client'`) tylko przy niezbędnej interaktywności. |
| **Strategia migracji** | **Przyrostowa, nigdy reset** | Reset bazy niszczy dane i ślad audytowy. |

### Klasyfikacja decyzji:
- **`[AUTO]`**: Odwracalna, techniczna → *Wybierz rekomendację, odnotuj w podsumowaniu, pracuj dalej.*
- **`[AUTO_LOGGED]`**: Trwała projektowa w granicach kontraktu → *Wybierz, zapisz w `docs/decisions/AUTO-<data>.md`, pracuj dalej.*
- **`[ESCALATE]`**: Krytyczne sytuacje prawne/zniszczenie danych → *Zatrzymaj się, przedstaw opcje w raporcie końcowym.*

---

## 8. NIENARUSZALNA PĘTLA WYKONAWCZA (8 ETAPÓW)

Dla każdego zadania wykonujesz sekwencyjnie i autonomicznie:

```
TRELLO SYNC ➔ PULL & PLAN ➔ CONTRACT ➔ RED ➔ GREEN ➔ VERIFY ➔ REVIEW ➔ INTEGRATE & TRELLO UPDATE
```

### Krok 0: TRELLO DISCOVERY & ASSIGNMENT CHECK
- Pobierz zadanie z Backlogu Trello.
- **Sprawdź przypisanie**: Tylko Twoje zadania (Darek: przypisane do Darka, Michał: przypisane do Michała). Jeśli nieprzypisane — pomiń!

### Krok 1: PULL & PLAN (Spec-Analyst)
- Wykonaj automatycznie `git pull`, by zsynchronizować kod i migracje bazy.
- Zbadaj architekturę repozytorium i stan `supabase/migrations/`.
- Zdefiniuj REQ-ID i utwórz Work Order: `docs/workorders/WO-<REQ-ID>.md`.
- W przypadku zadań UI: zbadaj powiązane makiety w `Figma-personel-portal/` i `figma-family-portal/`.

### Krok 2: CONTRACT (Contract-Steward)
- Jeśli wymagane są zmiany struktur/uprawnień:
  - `node tools/sc-contract-window.mjs open <REQ-ID>`
  - Edycja kontraktów w `contracts/*.contract.mjs`
  - `node tools/sc-codegen.mjs && node tools/sc-validate.mjs && node tools/sc-selftest.mjs`
  - `node tools/sc-contract-window.mjs close`

### Krok 3: RED (Test-Author — Gemini)
- Napisz testy behawioralne w `tests/`.
- Oznacz każdy test znacznikiem: `// @REQ: <REQ-ID>`.
- Uruchom testy i udowodnij, że padają z oczekiwanego powodu (RED).
- Zweryfikuj fazę: `node tools/sc-phase.mjs red`.

### Krok 4: GREEN (Implementer — Gemini)
- Zaimplementuj kod spełniający testy. W razie potrzeby zainstaluj sprawdzoną zależność (`pnpm add ... && pnpm audit --prod`).
- W przypadku komponentów UI: utwórz stories w Storybooku pokrywające 4 stany (`UI-FOUR-STATES`).
- Doprowadź testy do stanu zielonego (PASS).
- Zweryfikuj fazę: `node tools/sc-phase.mjs green`.

### Krok 5: VERIFY (Gatekeeper)
- Uruchom pełną bramkę jakościową projektu:
  ```bash
  bash scripts/verify.sh --full
  ```
- **Reguła Zero-Skip**: Status `POMINIĘTY` to błąd!
- **Self-Healing Loop**: W razie błędu podejmij autonomiczną próbę naprawy (max 3 iteracje).

### Krok 6: REVIEW & VIRTUAL ACCEPTANCE (Auditor-Trio — Claude Opus)
Niezależny audyt kodu pod kątem:
- Kryteriów Work Order i Storybooka (4 stany).
- Izolacji placówek (`organization_id` w RLS).
- Art. 9 RODO i PII (`pesel_hash`, brak danych w logach).
- Granicy MDR (brak „pacjent”, brak tętna/HRV bliskim, brak oceniania zdrowia).

### Krok 7: INTEGRATE & DEPLOY TO FEATURE BRANCH (Release-Engineer)
- Utwórz dedykowany feature branch: `feature/<nazwa-modułu>`.
- Wykonaj atomowe commity: `feat(<domena>): [<REQ-ID>] <opis>`.
- Wypchnij branch:
  ```bash
  git push -u origin feature/<nazwa-modułu>
  ```
- Przygotuj kompletny opis Pull Requesta.

### Krok 8: AKTUALIZACJA BACKLOGU TRELLO
- Zaktualizuj kartę w Trello powiązaną ze zrealizowanym zadaniem:
  - Przenieś kartę do kolumny **"PR Created / In Review"**.
  - Dodaj komentarz na karcie z odnośnikiem do brancha/PR, REQ-ID, listą commitów oraz potwierdzeniem zaliczenia bramki weryfikacyjnej (`verify.sh --full` 100% PASS).

---

## 9. RAPORT KOŃCOWY DLA CZŁOWIEKA (SESSION SUMMARY)

Po zakończeniu prac i wypchnięciu brancha przedstaw raport:

1. **[UKOŃCZONE FUNKCJONALNOŚCI]**: Lista REQ-ID, odnośniki do WO oraz zaktualizowanej karty Trello.
2. **[PODJĘTE DECYZJE AUTONOMICZNE]**: Klasa `[AUTO_LOGGED]` (dobrane biblioteki, struktury, decyzje UI).
3. **[STATUS BRAMKI I STORYBOOKA]**: Wynik `verify.sh --full` oraz stan stories w Storybooku.
4. **[AUDYT BEZPIECZEŃSTWA I MDR]**: Certyfikat czystości wystawiony przez model audytujący (Opus).
5. **[STATUS BRANCHA I PULL REQUESTA]**:
   - Nazwa brancha: `feature/...`
   - Lista commitów.
   - Gotowa komenda / link do zmergowania do `main` przez człowieka.
