# 📖 Kanoniczna specyfikacja user stories — Silver Care

> **Wersja:** 2.5 (bazuje na v2.4 + funkcje dopisane retroaktywnie) · **Ostatnia aktualizacja:** 2026-10-04
> **Właściciele:** Darek Rink, Michał Sznurowski

## Jak czytać i utrzymywać ten dokument

**Po co ten plik.** To jest narracyjna, produktowa warstwa dokumentacji: *kto*, *w jakiej sytuacji*, *po co* i *jakie scenariusze brzegowe*. Kontrakt (`contracts/*.contract.mjs`) mówi, co system **musi** robić i jest egzekwowany bramką; ten dokument mówi, **dlaczego** i dla kogo.

**Hierarchia źródeł.** Przy sprzeczności **wygrywa kontrakt** i ADR-y z [`01-ADR-decisions.md`](01-ADR-decisions.md). Rozbieżności z kontraktem są tu jawnie oznaczone jako **⚖️ Rozstrzygnięcie** — nie poprawiaj treści historycznego story, tylko dopisz rozstrzygnięcie.

**Reguła utrzymania (obowiązuje ludzi i agentów — patrz `AGENTS.md`).**
1. Każda nowa funkcja, która nie jest pokryta istniejącym story, dostaje nowe story z kolejnym ID w swojej domenie (np. `SC-NUR-11`), **zanim** powstanie Work Order.
2. Każde story ma linię `🔗 Kontrakt` z identyfikatorami `@REQ` z `contracts/requirements.contract.mjs` albo jawne `brak REQ`.
3. Nowe wymaganie w kontrakcie wskazuje story w polu `source` (np. `source: 'SC-NUR-07'`).
4. Zmiana zakresu istniejącej funkcji = aktualizacja story w tym samym PR co kod.
5. Story dodane przez agenta ma status **📝 PROPOZYCJA** do czasu akceptacji drugiej osoby w code review.

**Legenda statusów** (stan na dzień aktualizacji, liczony wobec kontraktu i znaczników `@REQ` w testach — `node tools/sc-trace.mjs`):

| Symbol | Znaczenie |
|---|---|
| ✅ | Wszystkie powiązane `@REQ` mają testy |
| 🟡 | Częściowo — część kryteriów nie ma odpowiednika w kontrakcie |
| ⏸️ | Świadomie odłożone (`DEFERRED` w kontrakcie) |
| ❌ | Brak wymagania w kontrakcie |
| 📄 | Zadanie procesowe / prawne, poza kodem |
| 🔭 | Backlog, poza MVP |
| 📝 | PROPOZYCJA — story dopisane retroaktywnie, czeka na akceptację |

---

## ⚙️ DOMENA 0: INFRASTRUKTURA (Przygotowanie Go-Live)

### [TASK-INFRA-01] Eskalacja instancji Supabase do planu Pro (PITR & Audit Log)
🔗 **Kontrakt:** `INFRA-PITR` · **Status:** ⏸️ DEFERRED

**Cel operacji:** Migracja produkcyjnego klastra Supabase na tier komercyjny w celu odblokowania funkcji bezpieczeństwa klasy Enterprise.

**Kryteria akceptacji:**
- **AC1 (Ciągłość danych):** Aktywacja Point-in-Time Recovery (PITR). System musi zapewniać retencję logów i metryk zdrowotnych z możliwością odtworzenia stanu bazy co do sekundy.
- **AC2 (Pełna rozliczalność):** Wdrożenie rozszerzenia pgAudit. Każda operacja odczytu danych wrażliwych (dostęp do profilu podopiecznego) musi generować niezmienialny ślad w rejestrze zdarzeń.

> ⚖️ **Rozstrzygnięcie (ADR-013):** odłożone do decyzji o skalowaniu poza pilotaż. Rozliczalność w MVP zapewnia aplikacyjna tabela `audit_logs` (`SEC-AUDIT-APPEND-ONLY`), działająca na planie darmowym.

---

## 👑 DOMENA 0.5: SUPER ADMIN (Globalna kontrola)

### [SC-SUP-01] Globalne zarządzanie placówkami
🔗 **Kontrakt:** brak dedykowanego REQ (częściowo `ORG-PROVISION`, `ORG-ISOLATION`) · **Status:** 🟡 — dashboard zaimplementowany (`supabase/migrations/20260914180000_superadmin_dashboard_rpc.sql`, `tests/db/superadmin_dashboard.test.ts`), ale bez własnego `@REQ`

**User story:** Jako Super Admin Silver Care, chcę mieć dostęp do globalnego widoku wszystkich placówek oraz zarządzać ich cyklem życia, aby móc sprawnie skalować system dla nowych klientów.

**Kryteria akceptacji:**
- **AC1 (Widok globalny):** Panel „Super Admin Dashboard" prezentuje listę wszystkich `organizations` z podsumowaniem: liczba aktywnych seniorów, liczba personelu, data utworzenia.
- **AC2 (Tworzenie placówki):** Super Admin może zainicjować proces tworzenia nowego ośrodka, generując automatycznie strukturę bazy danych (tenant isolation).
- **AC3 (User management):** Możliwość dodawania/usuwania kont administratorów ośrodków (`org_admin`) przypisanych do konkretnej organizacji.

### [SC-SUP-02] Debugging i impersonacja (Log-as-User)
🔗 **Kontrakt:** `SUP-IMPERSONATION` · **Status:** ✅

**User story:** Jako Super Admin, chcę mieć możliwość „zalogowania się jako" wybrany Administrator Ośrodka, aby móc szybko diagnozować problemy techniczne i udzielać wsparcia bez konieczności udostępniania mi haseł przez klienta.

**Kryteria akceptacji:**
- **AC1 (Bezpieczeństwo impersonacji):** Akcja „Zaloguj jako" generuje tymczasowy, krótko żyjący token (TTL = 1h) z ograniczonymi uprawnieniami.
- **AC2 (Audit trail):** Każde użycie funkcji „Log-as-User" jest logowane w `audit_logs` z pełnym kontekstem: ID Super Admina, ID celu (kogo udajemy) oraz timestamp.
- **AC3 (Ograniczenia):** Super Admin w trybie impersonacji nie może usuwać konta, w którym się znajduje, ani zmieniać ustawień bezpieczeństwa platformy.

### [SC-SUP-03] Onboarding nowej placówki i Administratora Ośrodka
🔗 **Kontrakt:** `ORG-ISOLATION` (AC4), `ORG-PROVISION` (AC2–AC3) · **Status:** ✅

**User story:** Jako Super Admin Silver Care, chcę tworzyć profile nowych ośrodków opieki oraz przypisywać im pierwszych Administratorów (`org_admin`), aby sprawnie skalować platformę dla nowych klientów.

**Kryteria akceptacji:**
- **AC1 (RBAC):** System weryfikuje rolę użytkownika w `app_metadata` (rola `super_admin` ma wyłączne uprawnienia do tabeli `organizations`).
- **AC2 (Provisioning):** Administrator może utworzyć nowy rekord w `organizations` (nazwa, adres, limit podopiecznych).
- **AC3 (Auto-onboarding):** Przy tworzeniu placówki system automatycznie tworzy pierwszego `org_admin` (konto personelu z rolą `org_admin`) i wysyła mu bezpieczne zaproszenie na maila.
- **AC4 (Izolacja):** Każdy nowy ośrodek ma wygenerowany unikalny `organization_id`. Wszystkie polityki RLS w systemie (dla seniorów, personelu i rodzin) są automatycznie izolowane do tego ID.

### [SC-SUP-04] Panel zarządzania tożsamością i dostępem (IAM) — 📝 dopisane po v2.4
🔗 **Kontrakt:** `SUP-IAM-PANEL` · **Work Order:** [`SUP-IAM-PANEL.md`](workorders/SUP-IAM-PANEL.md) · **Status:** ✅ 📝

**User story:** Jako Super Admin (Power Admin), chcę mieć panel do zarządzania rolami i uprawnieniami użytkowników, aby kontrolować dostęp do systemu z jednego miejsca i mieć ślad każdej zmiany.

**Kryteria akceptacji:**
- **AC1:** Panel widoczny i dostępny wyłącznie dla konta o roli `super_admin`.
- **AC2:** Możliwość zarządzania przypisaniem ról do kont użytkowników.
- **AC3:** Widok audytu zmian uprawnień zintegrowany z `audit_logs`; wpis `role_change` bez danych osobowych.

> ℹ️ Kontrakt od początku wskazywał `source: 'SC-SUP-04'`, ale story nie istniało w v2.4 — tu zostało uzupełnione.

---

## 👑 DOMENA 1: ADMINISTRATOR (Zarządzanie ośrodkiem)

### [SC-ADM-02] Dodawanie podopiecznego i przypisywanie rodziny
🔗 **Kontrakt:** `ADM-RESIDENT-ADD`, `SEC-PESEL-HASH` · **Status:** ✅

**User story:** Jako Administrator, chcę dodać profil podopiecznego i przypisać do niego członka rodziny (określając ich relację), aby rodzina mogła korzystać z platformy.

**Scenariusze:**
- **Przypadek 1 (Happy path):** Admin wpisuje dane podopiecznego (z PESEL-em), dodaje maila córki, ustawia relację „Córka" (`daughter`). System tworzy rekord `resident`, wysyła zaproszenie i dodaje rekord do `resident_relative_links`.
- **Przypadek 2 (Podopieczny już istnieje):** Admin próbuje dodać seniora o tym samym PESEL.

**Kryteria akceptacji:**
- **AC1 (Bezpieczeństwo):** Numer PESEL musi zostać zapisany wyłącznie jako hash (SHA-256 + salt) w kolumnie `pesel_hash`. Brak plaintextu w bazie.
- **AC2 (Izolacja):** Dodany senior musi mieć przypisany `organization_id` zgodny z tokenem JWT admina.
- **AC3 (Relacje):** Tabela `resident_relative_links` musi zapisać kod relacji (np. `relationship: 'daughter'`, `is_primary_contact: true`).

> ⚖️ **Rozstrzygnięcie (ADR-012):** przyjęcie może od razu obejmować przypisanie łóżka; pensjonariusz bez łóżka jest stanem poprawnym. Patrz też `SC-ADM-11`.

### [SC-ADM-03] Zarządzanie powiązaniami rodziny z seniorem (dodawanie i edycja dostępów)
🔗 **Kontrakt:** `ADM-RESIDENT-ADD`, `MDR-VOCABULARY` (AC1), `ORG-ISOLATION` (AC2), `ADM-INVITE` (AC4) · **Status:** 🟡 — AC3 (jeden aktywny kontakt główny) nie ma odpowiednika w kontrakcie

**User story:** Jako Administrator, chcę dodawać kolejnych członków rodziny do profilu podopiecznego, zmieniać ich relacje oraz edytować lub cofać ich uprawnienia, aby zapewnić właściwym osobom dostęp do raportów, a nieuprawnionym natychmiast go odcinać.

**Scenariusze:**
- **Przypadek 1 (Dodanie kolejnego członka rodziny — happy path):** Admin otwiera kartę seniora, podaje e-mail syna, wybiera kod relacji (`son`) oraz zaznacza, czy jest to kontakt główny (`is_primary_contact`). System dodaje wpis do `resident_relative_links` i wysyła zaproszenie.
- **Przypadek 2 (Konto rodziny już istnieje):** System nie tworzy nowego konta auth, lecz dopisuje kolejny rekord `resident_id <-> family_user_id` w tabeli `resident_relative_links`.
- **Przypadek 3 (Edycja relacji):** Admin zmienia relację z `daughter` na `legal_guardian`. System aktualizuje rekord w `resident_relative_links`.
- **Przypadek 4 (Cofnięcie dostępu):** Admin zmienia status na `revoked`. Silnik RLS natychmiast odcina dostęp do widoku `family_daily_reports`.

**Kryteria akceptacji:**
- **AC1 (Nomenklatura & MDR):** Używamy wyłącznie pojęć podopieczny / senior / pensjonariusz. Słowo zakazane z `FORBIDDEN_UI_TERMS` nie występuje w interfejsie i opisie funkcji ze względu na wymogi MDR.
- **AC2 (Natychmiastowa izolacja RLS):** Dostęp członka rodziny do danych seniora wynika wyłącznie z obecności aktywnego rekordu w tabeli `resident_relative_links`. Dodanie, modyfikacja lub usunięcie rekordu natychmiastowo zmienia wynik zapytań SQL wykonywanych przez konto rodziny (Postgres Row Level Security).
- **AC3 (Walidacja kontaktu głównego):** Tabela `resident_relative_links` pilnuje, aby dany senior miał tylko jeden aktywny kontakt główny (`is_primary_contact = true`). Ustawienie tej flagi dla nowej osoby automatycznie zdejmuje ją z poprzedniej.
- **AC4 (Brak wycieku PII przy zaproszeniach):** Jeśli rodzina nie ma jeszcze konta, zaproszenie e-mail zawiera bezpieczny token rejestracyjny. Token nie ujawnia w treści wiadomości danych osobowych ani PESEL-u podopiecznego przed zaktywowaniem konta.

> ⚖️ **Rozstrzygnięcie (ADR-003):** `legal_guardian` to **osobna rola** o innych uprawnieniach (jedyna po stronie bliskich, która może wyrazić zgodę), a nie kolejna wartość pola `relationship`. Przypadek 3 oznacza więc zmianę roli dostępowej, nie samego kodu pokrewieństwa.

### [SC-ADM-05] Archiwizacja podopiecznego (miękkie usunięcie RODO)
🔗 **Kontrakt:** `ADM-ARCHIVE`, `SEC-RETENTION` (AC4), `INT-INGEST-PRECONDITIONS` (AC3) · **Status:** ✅

**User story:** Jako Administrator, chcę zarchiwizować profil podopiecznego, aby odciąć dostęp rodzinie bez niszczenia logów audytowych, oraz mieć możliwość pełnego usunięcia danych (RODO).

**Kryteria akceptacji:**
- **AC1 (Miękka archiwizacja):** Ustawienie `archived_at = NOW()`. RLS całkowicie ukrywa seniora przed rodziną. Personel otrzymuje dostęp wyłącznie SELECT (blokada INSERT/UPDATE).
- **AC2 (Twarde usunięcie — art. 17 RODO):** Operacja DELETE kaskadowo kasuje logi, głosy i metryki. W rejestrze `audit_logs` dane osobowe są redagowane do `[REDACTED DUE TO GDPR]`.
- **AC3 (Blokada wejścia danych):** Zarówno archiwizacja, jak i usunięcie powodują, że webhooki z chmury Polar natychmiast odrzucają nowe paczki danych dla danego `resident_id`.
- **AC4 (Polityka retencji — RODO):** System posiada zautomatyzowaną politykę retencji danych archiwalnych (np. 5 lat od daty `archived_at`). Po upływie tego czasu system wykonuje kaskadowe, nieodwracalne usunięcie danych (twardy DELETE), zapisując w logu audytowym jedynie wpis: „Usunięcie danych zgodnie z polityką retencji [ID podopiecznego]".

### [SC-ADM-07] Logowanie dwuetapowe (MFA / 2FA) dla personelu
🔗 **Kontrakt:** `SEC-MFA-STAFF` · **Status:** ✅

**User story:** Jako Administrator lub Pielęgniarka, chcę logować się do systemu z użyciem drugiego składnika uwierzytelniania (aplikacji Authenticator), aby moje konto i dane podopiecznych były bezpieczne nawet w przypadku wycieku hasła.

**Kryteria akceptacji:**
- **AC1 (Wymuszenie AAL2):** Mechanizm logowania na frontendzie (Next.js) weryfikuje poziom sesji. Jeśli użytkownik ma rolę `nurse` lub `org_admin`, system wymusza podanie 6-cyfrowego kodu TOTP przed dopuszczeniem do jakichkolwiek widoków z danymi podopiecznych.
- **AC2 (Ekran onboardingu / parowania):** Przy pierwszym logowaniu do systemu pracownik widzi ekran z kodem QR do zeskanowania w aplikacji typu Google Authenticator / Authy.
- **AC3 (Weryfikacja sesji):** Jeśli pracownik zaloguje się tylko hasłem, backend bazy danych (Supabase RLS) i tak zablokuje mu dostęp do tabel, dopóki nie przejdzie poprawnie weryfikacji MFA. Wyjątkiem są konta rodzin (`family`), które pozostają przy zwykłym logowaniu.

### [SC-ADM-08] Wysyłanie bezpiecznych zaproszeń dla rodziny
🔗 **Kontrakt:** `ADM-INVITE` · **Status:** ✅

**User story:** Jako Administrator, chcę wysłać zaproszenie e-mail do członka rodziny, aby mógł on samodzielnie i bezpiecznie założyć konto powiązane z profilem jego bliskiego (podopiecznego).

**Kryteria akceptacji:**
- **AC1 (Brak wycieków PII):** Treść wiadomości e-mail z zaproszeniem zawiera jedynie bezpieczny, wygasający link (np. na 7 dni) oraz anonimowe powitanie. Nie może zawierać imienia, nazwiska ani PESEL-u podopiecznego.
- **AC2 (Tworzenie relacji):** Kliknięcie w link przez członka rodziny przenosi go na ekran ustawiania hasła. Po poprawnej rejestracji system automatycznie przypisuje nowo utworzone konto do odpowiedniego `resident_id` z ustaloną wcześniej przez administratora relacją (np. córka) z tabeli `family_invitations`.
- **AC3 (Unieważnianie):** Administrator ma w swoim panelu podgląd wysłanych zaproszeń ze statusem `pending` i może je w każdej chwili ręcznie unieważnić (`revoke`), zanim rodzina zdąży założyć konto.
- **AC4 (Zachowanie roli w OAuth):** Rola z zaproszenia (`legal_guardian` lub `family`) jest zachowywana także przy realizacji zaproszenia przez Google OAuth (`/auth/callback`), nie tylko przy rejestracji hasłem.

### [SC-ADM-09] Zarządzanie siecią placówek (Multi-Org View)
🔗 **Kontrakt:** brak REQ · **Status:** ❌

**User story:** Jako Administrator przypisany do sieci placówek, chcę widzieć wszystkie ośrodki w mojej sieci, aby szybko przełączać się między nimi i zarządzać personelem centralnie.

**Kryteria akceptacji:**
- **AC1 (Network scope):** Jeśli konto posiada przypisanie do wielu `organization_id`, system włącza „Network View" (przełącznik placówek w headerze).
- **AC2 (Kontekstualność):** Zmiana placówki w dropdownie odświeża RLS całego interfejsu (widzimy tylko seniorów i notatki z wybranej placówki).
- **AC3 (Raportowanie sieciowe):** Dashboard główny pokazuje agregat danych dla całej sieci (np. „Łącznie podopiecznych w sieci: 450").

> ⚠️ Wymaga decyzji przed realizacją: obecny model ról (`roles.contract.mjs`) zakłada jeden `organization_id` w tokenie dla `org_admin`.

---

## 🩺 DOMENA 2: PERSONEL (Pielęgniarki / Opiekunowie)

### [SC-NUR-01] Widok tablicy oddziału (Big Picture)
🔗 **Kontrakt:** `NUR-BOARD`, `ORG-ISOLATION` · **Status:** ✅

**User story:** Jako Personel, chcę widzieć listę pensjonariuszy w mojej placówce wraz ze statusem ich notatek dziennych (np. „Gotowy", „Draft otwarty", „Brak wpisu").

**Kryteria akceptacji:**
- **AC1 (Uprawnienia multi-tenant):** Personel widzi wyłącznie seniorów ze swojej placówki (wymuszane przez RLS na `organization_id`).

### [SC-NUR-02] Asystent głosowy (Dyktafon AI)
🔗 **Kontrakt:** `VOICE-DRAFT-ISOLATION` (AC1), `VOICE-ZERO-GUESSING` (AC2), `VOICE-RETENTION` (AC3), `VOICE-FOLLOWUP` (P2), `VOICE-MEDICAL-STRIP` (P1, P3) · **Status:** ✅

**User story:** Jako Pielęgniarka, chcę podyktować raport o seniorze do brudnopisu (`daily_logs`). Asystent AI rozdziela treść na brudnopis personelu i wersję bezpieczną dla rodziny. Asystent AI ma poinformować personel, jeśli jakiś podopieczny nie został zaraportowany lub brakuje danych.

**Scenariusze:**
- **Przypadek 1 (Pełny kontekst):** „Pan Jan zjadł cały obiad, spał dobrze, czuje się świetnie. Rano podano mu furosemid."
  *Then:* „Furosemid" ląduje w `daily_logs` (brudnopis). Reszta w `daily_reports_draft`.
- **Przypadek 2 (Brak kontekstu — follow-up):** „Pani Anna dzisiaj okej."
  *Then:* AI odsyła polecenie `follow_up`. Interfejs odtwarza/wyświetla pytanie: „A jak u Pani Anny z apetytem?". Pielęgniarka dogrywa odpowiedź.
- **Przypadek 3 (Naruszenie godności):** „Pan Tomasz zwymiotował na łóżko i miał biegunkę."
  *Then:* AI parsuje to do `daily_reports_draft` jako opis dyskomfortu, a oryginał trafia do `daily_logs`.

**Kryteria akceptacji:**
- **AC1 (Izolacja brudnopisów):** Tabela `daily_logs` jest niedostępna dla rodziny. Zredagowane podsumowanie trafia do draftu raportu dla rodziny (`daily_reports`).
- **AC2 (Zero-guessing entity resolution — kluczowe!):** Model AI ma absolutny zakaz zgadywania tożsamości seniora na podstawie samego nagrania. Aplikacja frontendowa (Next.js) musi przy inicjacji nagrania wysłać twardy UUID (`resident_id`) w payloadzie POST. Transkrypt wysyłany do LLM jest anonimowy, a ponowne złączenie notatki z tożsamością następuje dopiero w pamięci RAM funkcji brzegowej przed zapisem do bazy.
- **AC3 (Retencja):** Surowe zapisy w tabelach `voice_draft_notes` mają ustawiony TTL (czas życia) na 30 dni, po czym są automatycznie usuwane przez bazodanowego Crona.

> ⚖️ **Rozstrzygnięcie (ADR-006, ADR-007):** trzy strumienie `MEDICAL` / `DISCOMFORT` / `BEHAVIORAL` rozdzielane **przed** wejściem do modelu generującego; dane medyczne nigdy nie trafiają do promptu raportu dla bliskich.

### [SC-NUR-03] Zatwierdzanie raportów (wieczorny triage)
🔗 **Kontrakt:** `REPORT-APPROVAL` · **Status:** ✅

**User story:** Jako Pielęgniarka lub Administrator placówki, chcę zatwierdzić Peace Letter w tabeli `daily_reports`, aby udostępnić go rodzinie.

**Kryteria akceptacji:**
- **AC1:** W momencie generowania draftów system zapisuje metadane modelu AI (`ai_model`, `ai_prompt_version`), aby zapewnić „AI Provenance" dla celów audytowych.
- **AC2:** Kliknięcie „Zatwierdź" ustawia `status = 'published'` oraz zapisuje `approved_by`. Dopiero wtedy RLS udostępnia raport w widoku `family_daily_reports`.
- **AC3 (EU AI Act):** Raport dla rodziny musi posiadać etykietę: „Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki".

### [SC-NUR-04] Obsługa braku sieci w dyktafonie PWA (offline-first)
🔗 **Kontrakt:** `VOICE-OFFLINE` · **Status:** ✅

**User story:** Jako Pielęgniarka, chcę móc nagrywać notatki głosowe nawet w miejscach bez zasięgu internetu, mając pewność, że nagranie wysyła się automatycznie po odzyskaniu połączenia.

**Kryteria akceptacji:**
- **AC1 (Offline indicator):** Po utracie łączności sieciowej interfejs dyktafonu wyświetla dyskretną ikonę/baner „Tryb Offline".
- **AC2 (Kolejkowanie):** Nagrana notatka głosowa zostaje tymczasowo zapisana w lokalnej pamięci przeglądarki (IndexedDB). UI pokazuje licznik „Oczekujące nagrania (1)".
- **AC3 (Auto-sync):** Po powrocie połączenia sieciowego PWA automatycznie przesyła skolejkowane audio do Edge Function `voice-assistant` i informuje pielęgniarkę komunikatem Toast: „Notatki zostały pomyślnie przesłane".

### [SC-NUR-05] Zarządzanie harmonogramem dnia i aktywnościami placówki
🔗 **Kontrakt:** `NUR-AGENDA` · **Status:** ✅

**User story:** Jako Personel, chcę szybko dodawać i edytować pozycje w planie dnia (np. menu posiłków, zajęcia grupowe, wizyty terapeutyczne), aby rodzina mogła być na bieżąco z tym, co dzieje się w placówce.

**Kryteria akceptacji:**
- **AC1 (Struktura danych):** System umożliwia tworzenie wpisów w tabeli `agenda_items`. Każdy wpis posiada: `type` (np. „posiłek", „aktywność", „wizyta"), `title`, `description`, `start_time` oraz `is_communal` (flaga oznaczająca, czy dotyczy wszystkich, czy konkretnego seniora).
- **AC2 (Efektywność):** Personel może tworzyć „Szablony dnia" (np. standardowy jadłospis), aby nie wpisywać ręcznie powtarzalnych aktywności każdego dnia.
- **AC3 (Izolacja):** Każdy wpis w `agenda_items` jest automatycznie przypisywany do `organization_id`. Personel widzi i edytuje tylko harmonogramy własnej placówki (wymuszane przez RLS).
- **AC4 (Status):** Po zapisaniu harmonogram jest natychmiast dostępny do odczytu dla rodzin w ich portalu.

### [SC-NUR-06] Globalny pulpit pielęgniarski
🔗 **Kontrakt:** `NUR-BOARD` · **Status:** ✅

**User story:** Jako Pielęgniarka, chcę widzieć zbiorczy pulpit wszystkich moich podopiecznych, aby jednym rzutem oka wiedzieć, kto wymaga uwagi (np. brak notatki, zgłoszenia głosowe).

**Kryteria akceptacji:**
- **AC1 (Widok listy):** Tabela z listą wszystkich seniorów, gdzie każdy wiersz to status: [Zdjęcie | Imię | Status notatki (Gotowy/Draft/Brak) | Ostatnie zgłoszenie].
- **AC2 (Filtrowanie):** Możliwość filtrowania po sektorach/piętrach placówki.
- **AC3 (Szybka akcja):** Kliknięcie w status (np. „Brak wpisu") otwiera modal do szybkiego dodania notatki dla tego konkretnego seniora.

---

## 👨‍👩‍👧 DOMENA 3: RODZINA (Family Portal)

### [SC-FAM-01] Rejestracja rodziny z zaproszenia (onboarding flow)
🔗 **Kontrakt:** `FAM-ONBOARDING` · **Status:** ✅

**User story:** Jako zaproszony członek rodziny, chcę otworzyć link z e-maila, ustawić swoje hasło i zaakceptować regulamin, aby uzyskać dostęp do profilu mojego bliskiego.

**Kryteria akceptacji:**
- **AC1 (Walidacja tokena):** Wejście na stronę `/aktywacja?token=XYZ` weryfikuje token w tabeli `family_invitations`. Jeśli token wygasł (>7 dni) lub został anulowany, UI pokazuje czytelny komunikat błędu z prośbą o kontakt z placówką.
- **AC2 (Tworzenie konta):** Formularz wymaga podania bezpiecznego hasła oraz zaznaczenia zgód RODO. Po zatwierdzeniu system aktywuje konto, dopisuje wiersz do `resident_relative_links` z przypisaną relacją i automatycznie loguje użytkownika do Portalu Rodziny.

> ⚖️ **Rozstrzygnięcie (ADR-003):** zgody na przetwarzanie danych o zdrowiu wyraża wyłącznie pensjonariusz albo opiekun prawny — rola `family` akceptuje regulamin i zgody dotyczące własnego konta, nie zgody art. 9 za pensjonariusza.

### [SC-FAM-03] Sprawdzanie dashboardu w ciągu dnia (kluczowy scenariusz pętli)
🔗 **Kontrakt:** `FAM-DASHBOARD` (AC1), `MDR-NO-METRIC-ALARM` (AC2), `INT-SYNC-STALENESS` (AC3), `MDR-NO-PHYSIO-TO-FAMILY` · **Status:** ✅

**User story:** Jako zatroskany syn/córka, loguję się na portal, aby sprawdzić „Peace Letter" (Raport Dnia) mojego bliskiego i upewnić się, że wszystko jest w porządku.

**Scenariusze:**
- **Przypadek 1 (Godzina 09:00 — poranek):**
  *Given:* Nowy dzienny raport (Peace Letter) nie został jeszcze napisany.
  *When:* Rodzina otwiera aplikację.
  *Then:* Wyświetla się DUŻY kafelek: „Wczorajszy Raport (13 Sierpnia): Pan Jan czuł się świetnie...". Sekcja komfortu wyświetla stan oczekiwania na integrację.
- **Przypadek 2 (Godzina 14:00 — popołudnie):**
  *Given:* Opaska Polar synchronizuje się w placówce co 2 godziny.
  *When:* Rodzina wchodzi na dashboard.
  *Then:* Raport tekstowy wciąż jest z wczoraj. Użytkownik widzi status oczekiwania na publikację dzisiejszego Peace Letter.
- **Przypadek 3 (Godzina 20:15 — po wieczornym triage'u):**
  *Given:* Pielęgniarka zaakceptowała `daily_log`.
  *When:* Rodzina dostaje SMS. Wchodzi na aplikację.
  *Then:* Ekran główny płynnie zmienia stan. Pokazuje się „Raport na dziś (14 Sierpnia): Pan Jan był na spacerze...".

**Kryteria akceptacji:**
- **AC1:** Frontend odpytuje widok `family_daily_reports` o najnowszy rekord ze statusem `published`.
- **AC2 (Guardrails):** Aplikacja pod żadnym pozorem nie może renderować powiadomień typu „Push / Alarm" przy spadku liczby kroków. Aplikacja z zasady jest „cicha" dla IoT, a powiadomienia wysyła wyłącznie dla nowego Peace Letter.
- **AC3 (Brak łączności):** Jeśli w tabeli `polar_connections` pole `last_successful_sync_at` wskazuje czas starszy niż 6 godzin, UI delikatnie informuje: „Urządzenie obecnie poza zasięgiem huba".
- **AC4 (Empty state komfortu):** Karta Dzienny Komfort (wykresy z opaski) wyświetla się w stanie Empty State z szarym tłem i komunikatem: „Funkcja inteligentnych wskaźników komfortu jest w przygotowaniu", aby zostawić miejsce na przyszłe integracje.

> ⚖️ **Rozstrzygnięcie:**
> - **ADR-001:** ingest Polara **jest w MVP**, więc AC4 (pusty stan „w przygotowaniu") dotyczy tylko pensjonariusza bez połączonego urządzenia lub bez zgody.
> - **ADR-005 (wariant B):** karta komfortu pokazuje wyłącznie metryki behawioralne (kroki, czas aktywności, długość i godziny snu) — nigdy tętna, HRV ani wyniku snu.
> - **ADR-002:** tabela `polar_connections` z AC3 nie istnieje — stan synchronizacji żyje w warstwie integracyjnej (`external_wearable_links`), próg w `SYNC_STALENESS` w kontrakcie integracji.

### [SC-FAM-04] Zostawienie wiadomości (asynchroniczny hydrant)
🔗 **Kontrakt:** `FAM-MESSAGES` · **Status:** ✅

**User story:** Jako Rodzina, chcę wysłać krótką wiadomość („Przywiozę mu jutro nowe okulary"), by nie dzwonić na dyżurkę.

**Kryteria akceptacji:**
- **AC1 (Dane asynchroniczne):** Wiadomość trafia do tabeli `family_messages`. Są one niemutowalne i chronione przez RLS (wymagany status `active` w powiązaniu rodziny).
- **AC2 (Rate limiting):** Reguła Cloudflare WAF ogranicza wysyłkę do 3 wiadomości na godzinę per rodzina.

> ⚖️ **Rozstrzygnięcie:** kontrakt wymaga limitu 3/h na konto i czytelnego komunikatu po przekroczeniu — nie narzuca Cloudflare WAF jako mechanizmu. Odpowiedź personelu: `SC-NUR-07`.

### [SC-FAM-05] Przełączanie kontekstu podopiecznego
🔗 **Kontrakt:** `FAM-MULTI-RESIDENT` · **Status:** ✅

**User story:** Jako członek rodziny opiekujący się więcej niż jednym seniorem w placówce, chcę łatwo przełączać widok między moimi bliskimi.

**Kryteria akceptacji:**
- **AC1:** Jeśli konto rodziny jest powiązane w `resident_relative_links` z więcej niż jednym aktywnym `resident_id`, w nagłówku aplikacji wyświetla się rozwijane menu (Select) z listą imion seniorów.
- **AC2:** Zmiana wybranego seniora natychmiast odświeża stan dashboardu, ładując dedykowany widok `family_daily_reports` oraz `family_wearable_comfort` dla wybranego `resident_id`.

### [SC-FAM-06] Przeglądanie planu dnia i aktywności bliskiego
🔗 **Kontrakt:** `FAM-AGENDA` · **Status:** ✅

**User story:** Jako Rodzina, chcę widzieć plan dnia mojego bliskiego (menu, aktywności, zaplanowane wizyty), aby czuć większą bliskość z jego codziennym życiem i wiedzieć, czy uczestniczył w zajęciach.

**Kryteria akceptacji:**
- **AC1 (Dostępność):** Na dashboardzie (w widoku `SC-FAM-03`) pojawia się sekcja „Plan Dnia", która wyświetla dane z tabeli `agenda_items` dla danego seniora na aktualną datę.
- **AC2 (Widok zagregowany):** Rodzina widzi w jednym widoku zarówno aktywności indywidualne (np. „Rehabilitacja o 11:00"), jak i wspólne dla placówki (np. „Obiad", „Wspólne czytanie").
- **AC3 (RLS protection):** Dostęp jest chroniony przez RLS: rodzina może wykonać SELECT na `agenda_items` wyłącznie dla `resident_id` przypisanych do ich profilu w `resident_relative_links`.
- **AC4 (Empty state):** Jeśli plan dnia nie został uzupełniony przez personel, sekcja wyświetla komunikat: „Plan dnia na dziś jest w przygotowaniu przez zespół opiekunów".

---

## ⚖️ DOMENA 4: COMPLIANCE (Zapewnienie zgodności)

### [TASK-LEGAL-01] Formalizacja „fosy regulacyjnej" (RODO & podprocesorzy)
🔗 **Kontrakt:** pośrednio `INFRA-EU-REGION` (umowy powierzenia z dostawcami) · **Status:** 📄 — warunek pilotażu w [`00-PREREQUISITES.md`](00-PREREQUISITES.md)

**Cel operacji:** Sfinalizowanie umów z dostawcami zewnętrznymi w celu zabezpieczenia przetwarzania danych wrażliwych i budowy przewagi regulacyjnej.

**Kryteria akceptacji:**
- **AC1 (DPA z podprocesorem):** Zawarcie wiążącej umowy Data Processing Agreement z Polar Electro Oy. Podmiot ten zostaje oficjalnie zarejestrowany jako podprocesor danych telemetrycznych (model B2B).
- **AC2 (Transparentność & non-MD):** Aktualizacja polityki prywatności o zapisy o pseudonimizacji danych (ID sprzętowe) oraz ich rezydencji na terenie EOG. Jasne wskazanie celu: wyłącznie wsparcie dobrostanu (kategoria non-medical device).

### [SC-COMP-01] Mechanizm „feedback loop" (korekta błędów AI)
🔗 **Kontrakt:** `REPORT-AI-FEEDBACK` · **Status:** ✅

**User story:** Jako Pielęgniarka, chcę móc zgłosić błąd w wygenerowanym przez AI raporcie, aby zapewnić bezpieczeństwo danych i umożliwić analizę jakości modelu.

**Kryteria akceptacji:**
- **AC1 (Zgłaszanie):** W widoku edycji raportu (przed zatwierdzeniem) dostępny jest przycisk „Zgłoś błąd" (zamiast „Zatwierdź").
- **AC2 (Klasyfikacja):** System wymusza wybór kategorii błędu (np. Błąd medyczny, Halucynacja, Naruszenie prywatności), aby móc precyzyjnie kategoryzować incydenty w logach audytowych.
- **AC3 (AI provenance):** Zgłoszenie zapisuje snapshot wygenerowanego tekstu wraz z ID wersji modelu (`ai_prompt_version`) w tabeli `ai_feedback_log`, co tworzy ścieżkę audytową dla celów compliance.

---

## 🛡️ WYMAGANIA NIEFUNKCJONALNE (NFR) I BEZPIECZEŃSTWO

### [NFR-SEC-01] Reżim czystości logów (No PII Logging)
🔗 **Kontrakt:** `SEC-NO-PII-LOGS`, `NTF-NO-PII` · **Status:** ✅

**User story:** Jako Administrator Systemu, wymagam absolutnej blokady wycieku danych wrażliwych do warstwy infrastrukturalnej, aby zachować najwyższe standardy prywatności i zgodność z RODO.

**Kryteria akceptacji:**
- **AC1 (Izolacja logów):** Komponenty backendowe (Next.js, Edge Functions) mają zakaz przesyłania danych osobowych oraz telemetrycznych do konsoli i zewnętrznych systemów monitoringu (Vercel, Sentry, Datadog).
- **AC2 (Obsługa błędów):** Procedury try/catch mogą operować wyłącznie na anonimowych `resident_id` (UUID) i błędach technicznych. Wykrycie logowania obiektu z danymi pensjonariusza na produkcji traktowane jest jako krytyczny incydent.

### [NFR-SEC-02] Obligatoryjne uwierzytelnianie wieloskładnikowe (MFA)
🔗 **Kontrakt:** `SEC-MFA-STAFF` · **Status:** ✅

**User story:** Jako Administrator, chcę wymusić logowanie dwuetapowe dla personelu, aby zabezpieczyć dostęp do profili podopiecznych przed nieautoryzowanym przejęciem konta.

**Kryteria akceptacji:**
- **AC1 (Wymuszenie 2FA):** Konfiguracja Supabase Auth musi aktywnie blokować dostęp bez drugiego składnika (Authenticator/SMS) dla ról `org_admin` oraz `nurse`.

### [NFR-UI-01] Design system i UI
🔗 **Kontrakt:** `UI-FOUR-STATES` (AC1), `UI-ACCESSIBILITY` (AC3), `design.contract.mjs` (AC2) · **Status:** ✅

**User story:** Jako użytkownik, chcę korzystać z interfejsu opartego na nowoczesnym, ciepłym design systemie, aby praca z systemem była intuicyjna i kojąca.

**Kryteria akceptacji:**
- **AC1 (Storybook):** Każdy komponent (inputy, dashboard, listy) musi być dostępny w Storybooku w 4 stanach (Loading, Empty, Success, Error).
- **AC2 (Język wizualny):** Paleta kolorystyczna „Ciepłe Zaufanie" (beże, kojąca zieleń, wyraźna typografia sans-serif).
- **AC3 (Accessibility):** UI zgodne z WCAG 2.1 (odpowiedni kontrast, możliwość powiększania tekstu).

**Stany komponentów Next.js:**
- **Loading** — szkielety stron (Skeletons / UI Pulse).
- **Empty** — grafika i komunikat dla nowego seniora.
- **Error / Denied** — komunikaty braku zgód / HTTP 429.
- **Toast / Notifications** — pływające powiadomienia kontekstowe w rogu ekranu.

> ⚖️ **Rozstrzygnięcie (ADR-011):** tokeny (17 px tekst bazowy, kontrast min. 4.5:1, cel dotykowy 48 px) pochodzą z `design.contract.mjs`; kolor nie służy do oceny stanu zdrowia seniora.

### [NFR-SEC-04] Security incident response (SIEM lite)
🔗 **Kontrakt:** `SEC-403-LOGGING` · **Status:** ✅

**User story:** Jako Super Admin, chcę być informowany o podejrzanych próbach dostępu do bazy danych, aby móc reagować na potencjalne incydenty bezpieczeństwa.

**Kryteria akceptacji:**
- **AC1 (Audit log):** Wszystkie zdarzenia HTTP 403 Forbidden (odmowa dostępu RLS) są logowane do tabeli `security_audit` z pełnym kontekstem: ID użytkownika, timestamp, ścieżka API i adres IP.
- **AC2 (Alertowanie):** W przypadku przekroczenia progu 10 nieudanych prób dostępu z jednego IP w ciągu 1 minuty system wysyła alert do kanału monitoringu, wymagając potwierdzenia „akcji naprawczej" przez admina.

### [NFR-SEC-05] Zarządzanie sesjami użytkownika
🔗 **Kontrakt:** `SEC-SESSION` · **Status:** ✅

**User story:** Jako użytkownik systemu, chcę mieć kontrolę nad moimi aktywnymi sesjami, aby móc bezpiecznie zarządzać dostępem do danych.

**Kryteria akceptacji:**
- **AC1 (Globalny sign-out):** W ustawieniach profilu użytkownik widzi listę aktywnych urządzeń i posiada przycisk „Wyloguj ze wszystkich urządzeń", który unieważnia wszystkie aktywne tokeny sesyjne w Supabase Auth.
- **AC2 (Bezpieczeństwo sesji):** Sesje nieaktywne powyżej 30 minut są automatycznie unieważniane (tylko dla ról personelu i adminów).

---

## 🆕 DOPISANE PO v2.4 (retroaktywnie, na podstawie zrealizowanych Work Orderów)

> 📝 Wszystkie poniższe story mają status **PROPOZYCJA**. Powstały z Work Orderów i commitów, które weszły do `main` bez odpowiednika w v2.4. Treść opisuje zakres faktycznie zrealizowany; ID nadano jako kolejne w domenie. Wymagają akceptacji w code review.
>
> ⚠️ **Kolizja identyfikatorów:** Work Ordery `ADM-BULK-IMPORT` i `ADM-DATA-EXPORT` powołują się na wewnętrzne ID `ADM-07` i `ADM-08`, które kolidują z `SC-ADM-07` (MFA) i `SC-ADM-08` (zaproszenia). Tutaj dostają nowe ID `SC-ADM-13` i `SC-ADM-14`.

### Domena 1 — Administrator

#### [SC-ADM-10] Rejestr pokoi i łóżek placówki
🔗 **Kontrakt:** `ADM-FACILITY-MANAGE`, `ADM-BED-ASSIGNMENT`, `ADM-FACILITY-OCCUPANCY` (źródło: ADR-012) · **WO:** [`ADM-FACILITY-MANAGE`](workorders/ADM-FACILITY-MANAGE.md), [`ADM-BED-ASSIGNMENT`](workorders/ADM-BED-ASSIGNMENT.md), [`ADM-FACILITY-OCCUPANCY`](workorders/ADM-FACILITY-OCCUPANCY.md), [`ADM-FACILITY-BEDS-MANAGEMENT`](workorders/ADM-FACILITY-BEDS-MANAGEMENT.md) · **Status:** ✅ 📝

**User story:** Jako Administrator, chcę prowadzić rejestr pięter, pokoi i łóżek oraz widzieć obłożenie bez ręcznego liczenia, aby wiedzieć, gdzie mogę przyjąć nowego pensjonariusza.

**Kryteria akceptacji:**
- **AC1:** Hierarchia organizacja → piętro → pokój → łóżko; numer pokoju unikalny w placówce, etykieta łóżka unikalna w pokoju.
- **AC2:** Jedno łóżko ma co najwyżej jednego aktywnego pensjonariusza, jeden pensjonariusz — co najwyżej jedno aktywne łóżko (wymuszane na poziomie bazy).
- **AC3:** Przeniesienie pensjonariusza to jedna transakcja zamykająca stare przypisanie i otwierająca nowe; historia przypisań zachowana (`unassigned_at`).
- **AC4:** Liczba wolnych łóżek wyliczana z aktywnych przypisań i aktualna natychmiast po zmianie.
- **AC5:** Widok kafelków i tabeli z filtrowaniem po piętrze, sektorze, obłożeniu i frazie.

#### [SC-ADM-11] Kreator przyjęcia pensjonariusza z sugestią łóżka
🔗 **Kontrakt:** `ADM-RESIDENT-ADD`, `ADM-BED-ASSIGNMENT`, `SEC-PESEL-HASH` · **WO:** [`ADM-RESIDENT-WIZARD`](workorders/ADM-RESIDENT-WIZARD.md), [`ADM-AI-BED-ALLOCATION`](workorders/ADM-AI-BED-ALLOCATION.md); commit `ADM-RESIDENT-ADMISSION-CARD` · **Status:** ✅ 📝

**User story:** Jako Administrator, chcę przyjąć pensjonariusza w jednym kreatorze (dane → łóżko → oświadczenia), z podpowiedzią najlepszego wolnego łóżka, aby przyjęcie było szybkie i nie kończyło się kolizją przypisań.

**Kryteria akceptacji:**
- **AC1:** Krok 1 waliduje PESEL i uzupełnia datę urodzenia i płeć; poziom opieki i pakiet ZSN.
- **AC2:** Krok 2 sugeruje łóżko według reguł: zgodność płci w pokoju wieloosobowym, mobilność (osoby leżące bliżej parteru), grupowanie ZSN.
- **AC3:** Utworzenie pensjonariusza i przypisanie łóżka to jedna atomowa transakcja (`admit_resident_with_bed`) — kolizja = rollback z czytelnym komunikatem.
- **AC4:** Ekran sukcesu prowadzi do karty pensjonariusza; umowa jako załącznik w karcie.

#### [SC-ADM-12] Import/eksport struktury placówki i głosowe dyktowanie pokoju
🔗 **Kontrakt:** `ADM-FACILITY-MANAGE`, `ADM-FACILITY-OCCUPANCY`, `INFRA-EU-REGION` · **WO:** [`ADM-FACILITY-IO-VOICE`](workorders/ADM-FACILITY-IO-VOICE.md) · **Status:** ✅ 📝

**User story:** Jako Administrator nowej placówki, chcę zaimportować strukturę pokoi i łóżek z arkusza albo podyktować definicję pokoju głosem, aby nie wpisywać całego budynku ręcznie.

**Kryteria akceptacji:**
- **AC1:** Eksport struktury do XLSX (arkusze Pokoje i Łóżka ze statusem zajętości) i JSON; szablon XLSX do pobrania.
- **AC2:** Import dwuetapowy: dry-run z wykrywaniem kolizji numerów i etykiet, potem atomowy commit.
- **AC3:** Dyktowanie pokoju: transkrypcja, ekstrakcja parametrów (numer, piętro, sektor, łóżka) przez model w EOG do **edytowalnego podglądu** przed zapisem.

#### [SC-ADM-13] Masowy import pensjonariuszy z pliku
🔗 **Kontrakt:** brak dedykowanego REQ (dotyka `ADM-RESIDENT-ADD`, `SEC-PESEL-HASH`) · **WO:** [`ADM-BULK-IMPORT`](workorders/ADM-BULK-IMPORT.md) · **Status:** 🟡 📝

**User story:** Jako Administrator placówki przechodzącej z papieru lub innego systemu, chcę zaimportować listę pensjonariuszy z pliku Excel/CSV z podglądem błędów, aby uruchomić placówkę w jeden dzień.

**Kryteria akceptacji:**
- **AC1:** Dry-run: parsowanie `.xlsx`/`.csv`, walidacja PESEL, wykrycie duplikatów w pliku i w placówce.
- **AC2:** Podgląd wierszy poprawnych i błędnych z opisem problemu.
- **AC3:** Zapis wyłącznie poprawnych wierszy, w chunkach, z wpisem w `audit_logs` (liczba rekordów, bez PII).
- **AC4:** Szablon pliku do pobrania z panelu.

#### [SC-ADM-14] Bezpieczny eksport danych placówki
🔗 **Kontrakt:** brak dedykowanego REQ · **WO:** [`ADM-DATA-EXPORT`](workorders/ADM-DATA-EXPORT.md) · **Status:** ❌ 📝

**User story:** Jako Administrator, chcę wygenerować zestawienie podopiecznych i obłożenia (XLSX/CSV/PDF), aby przekazać je do rozliczeń lub kontroli bez ręcznego przepisywania.

**Kryteria akceptacji:**
- **AC1:** Filtry: aktywni / zarchiwizowani / wszyscy, tylko ZSN.
- **AC2:** Formaty XLSX, CSV (UTF-8 z BOM), JSON/PDF.
- **AC3:** Każdy eksport rejestrowany w `audit_logs` bez danych osobowych.

#### [SC-ADM-15] Zarządzanie kontami personelu i zaproszeniami ról
🔗 **Kontrakt:** `ORG-ISOLATION`, `SEC-SESSION`, `CONSENT-GRANTOR` (podział `legal_guardian` / `family`) · **WO:** [`NUR-STAFF-MANAGEMENT`](workorders/NUR-STAFF-MANAGEMENT.md); commit `ADM-STAFF-INVITATIONS-ROLES` · **Status:** 🟡 📝

**User story:** Jako Administrator placówki, chcę zapraszać personel i kolejnych administratorów, resetować im hasła i zawieszać konta, aby samodzielnie obsługiwać rotację pracowników bez angażowania Silver Care.

**Kryteria akceptacji:**
- **AC1:** Reset hasła (link albo hasło tymczasowe z wymuszoną zmianą).
- **AC2:** Odwracalne zawieszenie / przywrócenie konta z potwierdzeniem.
- **AC3:** Operacje na użytkownikach innej placówki kończą się 403. Próba wysłania zaproszenia bliskiego do pensjonariusza obcej placówki zwraca 404 (taka sama odpowiedź jak dla nieistniejącego, brak wyroczni istnienia rekordów).
- **AC4:** Zaproszenie bliskiego rozróżnia rolę `legal_guardian` i `family`; rola z zaproszenia jest zachowywana także przy realizacji przez Google OAuth (`/auth/callback`).
- **AC5:** Każda akcja w `audit_logs` bez PII.

#### [SC-ADM-16] Szybka edycja danych pensjonariusza (inline i panel boczny)
🔗 **Kontrakt:** `ADM-RESIDENT-ADD`, `SEC-NO-PII-LOGS` · **WO:** [`UI-GRANULAR-EDITING`](workorders/UI-GRANULAR-EDITING.md) · **Status:** 🟡 📝

**User story:** Jako Administrator, chcę edytować poziom opieki, ZSN i podstawowe dane pensjonariusza bez opuszczania listy, aby drobne korekty zajmowały sekundy.

**Kryteria akceptacji:**
- **AC1:** Edycja w miejscu: poziom opieki, ZSN, uwagi; panel boczny dla danych profilu.
- **AC2:** Aktualizacja optymistyczna z rollbackiem i komunikatem przy błędzie.
- **AC3:** Uprawnienia zgodne z `MATRIX`; każda zmiana w `audit_logs` z listą zmienionych pól, bez wartości wrażliwych.

### Domena 2 — Personel

#### [SC-NUR-07] Skrzynka wiadomości od rodzin
🔗 **Kontrakt:** `FAM-MESSAGES`, `NUR-BOARD` · **WO:** [`NUR-MESSAGES-INBOX`](workorders/NUR-MESSAGES-INBOX.md) · **Status:** ✅ 📝

**User story:** Jako Personel, chcę widzieć wiadomości zostawione przez rodziny i odpowiadać na nie w wątkach, aby domknąć pętlę komunikacji z `SC-FAM-04` bez telefonów na dyżurkę.

**Kryteria akceptacji:**
- **AC1:** Widok `/staff/messages` z listą wątków per pensjonariusz, wyłącznie z własnej placówki.
- **AC2:** Odpowiedź personelu dołącza do wątku; wiadomości pozostają niezmienialne.
- **AC3:** Wejście do skrzynki z nawigacji (desktop i mobile).

#### [SC-NUR-08] Redukcja kliknięć: szybki obchód, paleta poleceń, agenda dyżuru
🔗 **Kontrakt:** `NUR-BOARD`, `NUR-AGENDA`, `REPORT-APPROVAL` · **WO:** [`NUR-CLICK-REDUCTION`](workorders/NUR-CLICK-REDUCTION.md); commit `NUR-STAFF-WORKFLOW-AGENDA` · **Status:** ✅ 📝

**User story:** Jako Pielęgniarka na dyżurze, chcę dotrzeć do notatki konkretnego pensjonariusza w dwóch kliknięciach i zatwierdzać raporty seriami, aby dokumentacja nie zjadała czasu opieki.

**Kryteria akceptacji:**
- **AC1:** Tryb szybkiego obchodu: duże kafelki z bezpośrednim przejściem do notatki, filtry tokenowe.
- **AC2:** Paleta poleceń (Cmd/Ctrl+K) — wyszukanie pensjonariusza i start dyktowania w < 2 s.
- **AC3:** Masowe zatwierdzanie raportów (do 10 naraz) — każdy raport nadal przechodzi `REPORT-APPROVAL`.
- **AC4:** Widok „Agenda na dziś" z porami dnia i edycją.

#### [SC-NUR-09] Strażnik kompletności raportu przed publikacją
🔗 **Kontrakt:** `REPORT-AI-FEEDBACK`, `REPORT-APPROVAL`, `MDR-VOCABULARY` · **WO:** [`NUR-REPORT-COMPLETENESS-GATE`](workorders/NUR-REPORT-COMPLETENESS-GATE.md) · **Status:** ✅ 📝

**User story:** Jako Pielęgniarka, chcę dostać podpowiedź, że raport nie odpowiada na typowe pytania rodziny (posiłki, nastrój, aktywność, sen), zanim go zatwierdzę, aby rodzina nie dzwoniła z dopytaniem.

**Kryteria akceptacji:**
- **AC1:** Analiza strumienia behawioralnego pod kątem czterech wymiarów troski rodziny.
- **AC2:** Brakujący wymiar = podpowiedź dla personelu, nie blokada i nie dopisanie treści przez model.

#### [SC-NUR-10] Kontrolowany podgląd PESEL (step-up) — 🚫 Wycofane
🔗 **Kontrakt:** `SEC-PESEL-HASH` · **WO:** [`SEC-PESEL-STEP-UP`](workorders/SEC-PESEL-STEP-UP.md) · **Status:** 🚫 Wycofane (zastąpione przez `SEC-PESEL-HASH`, ADR-008, PR #39)

**User story:** Jako uprawniony pracownik (`nurse`, `org_admin`), chcę jednorazowo odsłonić PESEL podopiecznego po ponownym podaniu hasła i wskazaniu powodu, aby obsłużyć sprawy urzędowe (np. NFZ) bez trzymania PESEL-u na wierzchu.

**Kryteria akceptacji:**
- **AC1:** PESEL domyślnie zamaskowany.
- **AC2:** Odsłonięcie wymaga hasła i powodu; błędne hasło → `AUTH_FAILURE` w logu.
- **AC3:** Odsłonięcie na maks. 30 s, wyłącznie w pamięci stanu.
- **AC4:** Każda próba w `audit_logs` z powodem i ID podopiecznego, bez numeru PESEL.

> ⚖️ **Rozstrzygnięcie:** Wycofane w PR #39 (`SEC-PESEL-HASH`, ADR-008). Zgodnie z nadrzędną regułą `AGENTS.md` (*„PESEL wyłącznie jako `pesel_hash`."*) oraz kontraktem `SEC-PESEL-HASH`, w bazie danych nie ma kolumny z wartością jawną ani odwracalną (`pesel_encrypted` i moduł kryptograficzny zostały usunięte z bazy i kodu). Podgląd wartości PESEL nie jest wspierany.

#### [SC-USR-01] Własny profil i bezpieczeństwo konta
🔗 **Kontrakt:** `SEC-SESSION`, `SEC-MFA-STAFF` · **WO:** [`NUR-PROFILE-SECURITY`](workorders/NUR-PROFILE-SECURITY.md) · **Status:** ✅ 📝

**User story:** Jako dowolny użytkownik (personel, admin, bliski), chcę mieć stronę profilu, na której zmienię hasło, wyloguję inne urządzenia i zobaczę stan MFA, aby samodzielnie dbać o bezpieczeństwo konta.

**Kryteria akceptacji:**
- **AC1:** Podgląd konta i roli z `app_metadata.role`.
- **AC2:** Zmiana hasła z weryfikacją bieżącego i polityką siły; zdarzenie w `audit_logs`.
- **AC3:** Wylogowanie z pozostałych urządzeń.
- **AC4:** Podgląd stanu MFA (TOTP).

### Wymagania niefunkcjonalne

#### [NFR-VOICE-01] Asynchroniczny potok notatek głosowych z kolejką
🔗 **Kontrakt:** `VOICE-ZERO-GUESSING`, `VOICE-OFFLINE`, `REPORT-APPROVAL` · **WO:** [`VOICE-ASYNC-PIPELINE`](workorders/VOICE-ASYNC-PIPELINE.md) · **Status:** ✅ 📝

**User story:** Jako Pielęgniarka, chcę, żeby wysłanie nagrania kończyło się natychmiast, a przetwarzanie działo się w tle z ponowieniami, aby nie czekać przy łóżku na model.

**Kryteria akceptacji:**
- **AC1:** `POST /api/voice/submit` zwraca 202 z `draft_id` w < 1,5 s.
- **AC2:** Statusy przetwarzania w `voice_draft_notes` (od `QUEUED` do `READY_FOR_APPROVAL` / `FAILED_PERMANENT`), maks. 3 próby.
- **AC3:** Pobieranie zadań atomowe (`FOR UPDATE SKIP LOCKED`), odzyskiwanie po timeoucie.

#### [NFR-VOICE-02] Wierność raportu wobec nagrania
🔗 **Kontrakt:** `VOICE-ZERO-GUESSING`, `VOICE-MEDICAL-STRIP`, `MDR-NO-INTERPRETATION`, `REPORT-APPROVAL` · **WO:** [`VOICE-REPORT-FIDELITY`](workorders/VOICE-REPORT-FIDELITY.md) · **Status:** ✅ 📝

**User story:** Jako Rodzina, chcę mieć pewność, że raport opisuje to, co się faktycznie wydarzyło — także dolegliwości, w godnej formie — a nie uspokajającą fikcję.

**Kryteria akceptacji:**
- **AC1:** Zasada „Dignity Translation" zamiast pomijania dolegliwości: godny opis + reakcja personelu + status.
- **AC2:** Brak cichego mockowania przy braku klucza API — jawny błąd.
- **AC3:** Niepoprawny JSON z modelu nie przepuszcza surowego transkryptu do strumienia behawioralnego.
- **AC4:** Prompt nie każe dopisywać „spokojnego dnia", gdy nagranie o tym nie mówi.

#### [NFR-INFRA-02] Model językowy potoku głosowego w EOG
🔗 **Kontrakt:** `INFRA-EU-REGION`, `INFRA-GROQ-TRANSCRIPTION` (ADR-009) · **WO:** [`INFRA-EU-VOICE-LLM`](workorders/INFRA-EU-VOICE-LLM.md), [`VOICE-GROQ-FALLBACK`](workorders/VOICE-GROQ-FALLBACK.md) · **Status:** ✅ 📝

**User story:** Jako placówka, chcę, żeby klasyfikacja i generowanie raportu z danych art. 9 odbywały się w EOG, a poza EOG wychodziło wyłącznie surowe audio do transkrypcji (wyjątek ADR-009).

**Kryteria akceptacji:**
- **AC1:** `TRANSCRIBE` w Groq (SCC, zerowa retencja); `CLASSIFY` i `GENERATE` u dostawcy w EOG.
- **AC2:** Do Groq nie trafia żaden prompt tekstowy z notatką ani zredagowany transkrypt.

> ⚖️ **Rozstrzygnięcie:** PR #38 (`fix/sec-eu-llm-no-fallback`) usunął fallback Groq/xAI. `apps/web/src/lib/eu-llm-client.ts` przy braku klucza EU rzuca `[EU-LLM-CONFIG]` („przełączanie na dostawcę spoza EOG jest wyłączone”), a endpoint spoza EOG kończy się `[EU-LLM-REGION]`. AC2 jest w pełni spełnione.

#### [NFR-INT-01] Integracja Polar AccessLink z buforem wsadowym
🔗 **Kontrakt:** `INT-CORE-DECOUPLED`, `INT-INGEST-PRECONDITIONS`, `INT-NORMALIZATION`, `INT-SYNC-STALENESS` · **WO:** [`INT-POLAR-ACCESSLINK`](workorders/INT-POLAR-ACCESSLINK.md), [`INT-WEARABLE-BUFFER`](workorders/INT-WEARABLE-BUFFER.md) · **Status:** ✅ 📝

**User story:** Jako placówka, chcę, żeby dane z opasek Polar trafiały do systemu automatycznie, tylko przy aktywnej zgodzie i bez duplikatów, aby karta komfortu w `SC-FAM-03` była aktualna.

**Kryteria akceptacji:**
- **AC1:** OAuth2 z nagłówkiem `Authorization: Basic` (`OAUTH_CONFIG`); token per `external_wearable_links`.
- **AC2:** Paczka odrzucana przy braku zgody lub zarchiwizowanym pensjonariuszu — jeden wpis `INGEST_REJECTED` bez PII.
- **AC3:** Normalizacja (ISO 8601 → minuty) i deduplikacja.

#### [NFR-NTF-01] Brak podwójnych powiadomień (outbox)
🔗 **Kontrakt:** `NTF-REPORT-READY`, `NTF-NO-PII` · **WO:** [`NTF-OUTBOX-CONCURRENCY`](workorders/NTF-OUTBOX-CONCURRENCY.md) · **Status:** ✅ 📝

**User story:** Jako Rodzina, chcę dostać dokładnie jedno powiadomienie o raporcie, nawet gdy workery działają równolegle.

**Kryteria akceptacji:**
- **AC1:** Atomowe blokowanie zadań (`FOR UPDATE SKIP LOCKED`), odzyskiwanie blokad po 10 min.
- **AC2:** Wykładniczy backoff, `FAILED` dopiero po 3 próbach.

#### [NFR-SEC-06] Utwardzenie API, middleware i wydajność RLS
🔗 **Kontrakt:** `SEC-SESSION`, `SEC-403-LOGGING`, `SEC-NO-PII-LOGS`, `ORG-ISOLATION` · **WO:** [`SEC-AUDIT-HARDENING`](workorders/SEC-AUDIT-HARDENING.md), [`SEC-API-HARDENING-PAGINATION`](workorders/SEC-API-HARDENING-PAGINATION.md), [`SEC-MIDDLEWARE-EDGE`](workorders/SEC-MIDDLEWARE-EDGE.md), [`SEC-RLS-PERF`](workorders/SEC-RLS-PERF.md) · **Status:** ✅ 📝

**User story:** Jako operator platformy, chcę, żeby każda trasa API była domyślnie chroniona, błędy nie ujawniały szczegółów bazy, a RLS nie spowalniał systemu przy wzroście liczby placówek.

**Kryteria akceptacji:**
- **AC1:** Middleware na brzegu z jawną białą listą tras publicznych; rola z `app_metadata`, nie `user_metadata`.
- **AC2:** Centralny wrapper autoryzacji i obsługi błędów maskujący błędy bazy.
- **AC3:** Rate limiting na trasach wrażliwych (transkrypcja, zaproszenia, rejestracja, sync).
- **AC4:** Paginacja serwerowa list; indeksy kompozytowe pod polityki RLS.

#### [NFR-UI-02] Widoki mobilne, odświeżony motyw i optymalizacja mediów
🔗 **Kontrakt:** `UI-ACCESSIBILITY`, `UI-FOUR-STATES` · **WO:** [`UI-MOBILE-RESIDENTS`](workorders/UI-MOBILE-RESIDENTS.md), [`UI-DESIGN-SYSTEM-REFRESH`](workorders/UI-DESIGN-SYSTEM-REFRESH.md); commity `SYS-MEDIA-OPTIMIZATION`, `UI-FEEDBACK-TOOLTIPS` · **Status:** ✅ 📝

**User story:** Jako Personel pracujący na telefonie, chcę czytelnych kart zamiast szerokich tabel, spójnego motywu i szybko ładujących się zdjęć, aby system był wygodny przy łóżku pensjonariusza.

**Kryteria akceptacji:**
- **AC1:** Poniżej 640 px lista kart pensjonariuszy zamiast tabeli; cele dotykowe zgodne z `design.contract.mjs`.
- **AC2:** Motyw zgodny z paletą „Ciepłe Zaufanie" i tokenami z kontraktu; strona logowania odświeżona.
- **AC3:** Kompresja zdjęć w przeglądarce i usuwanie metadanych EXIF przed wysłaniem.
- **AC4:** Brak natywnych `alert()`/`confirm()` — Toast i dostępny `ConfirmDialog`.

---

## 💡 USER STORIES DO ANALIZY (Backlog / poza MVP)

### [SC-ADM-04] Parowanie urządzeń BLE (integracja z bramką/hubem)
🔗 **Kontrakt:** brak REQ · **Status:** 🔭

> ⚖️ **Rozstrzygnięcie (ADR-001, ADR-002):** MVP integruje opaski przez chmurę Polar AccessLink, nie przez lokalną bramkę BLE. Gdyby hub wrócił, identyfikatory urządzeń muszą żyć w `external_wearable_links`, nie w nowej tabeli rdzenia.

**User story:** Jako Administrator, chcę zarejestrować i przypisać własne urządzenie BLE podopiecznego (poprzez centralną bramkę/hub zainstalowaną w placówce) do jego profilu w systemie, aby możliwe było zbieranie wskaźników komfortu i samopoczucia.

**Kryteria akceptacji:**
- **AC1 (Provisioning):** System umożliwia powiązanie `device_serial_number` z `resident_id` w tabeli `ble_devices`.
- **AC2 (Bezpieczeństwo hub-to-Supabase):** Bramka BLE (Hub) komunikuje się z backendem Supabase wyłącznie poprzez bezpieczne API (PostgREST / Edge Functions). Każda paczka danych jest autoryzowana za pomocą unikalnego klucza urządzenia (`device_secret`) przechowywanego w bezpiecznej tabeli `gateway_keys`.
- **AC3 (Transmisja danych):** Dane z opaski są odbierane przez Hub, buforowane (w razie utraty sieci) i wysyłane do Supabase z wykorzystaniem walidacji HMAC-SHA256 (zapobiegającej wstrzykiwaniu danych/spoofingowi).
- **AC4 (Inicjalizacja):** Po sparowaniu system automatycznie weryfikuje status urządzenia poprzez testowy „ping" od bramki.

### [SC-ADM-06] Monitoring łączności bramki BLE i integralności strumienia
🔗 **Kontrakt:** brak REQ · **Status:** 🔭

> ⚖️ **Rozstrzygnięcie (`MDR-NO-METRIC-ALARM`):** AC3 dotyczy wyłącznie alertu technicznego dla administratora o braku transmisji urządzenia — nie może być powiadomieniem o stanie pensjonariusza. Odpowiednik w kontrakcie powiadomień: `A1 device_sync_stale`.

**User story:** Jako Administrator, chcę monitorować stan połączenia bramki BLE oraz poprawność strumienia danych w czasie rzeczywistym, aby móc zareagować na awarię sprzętową lub przerwę w transmisji, zanim wpłynie to na jakość opieki.

**Kryteria akceptacji:**
- **AC1 (Heartbeat):** System monitoruje sygnał „heartbeat" wysyłany przez bramkę BLE w interwałach czasowych (np. co 5 minut). Brak sygnału przez określony czas (timeout) oznacza status `connection_degraded` dla całej placówki lub danego sektora.
- **AC2 (Wykrywanie luk w danych):** System automatycznie wykrywa brak aktywności (brak nowych wierszy w tabeli `comfort_metrics` dla aktywnego urządzenia) i flaguje to jako zdarzenie wymagające uwagi.
- **AC3 (Alertowanie):** W przypadku braku danych przez > 30 minut Administrator otrzymuje powiadomienie o „Braku strumienia danych z urządzenia [ID]".

### [SC-FAM-02] Zarządzanie zgodami na dane IoT (Consent Ledger)
🔗 **Kontrakt:** `CONSENT-LEDGER-IMMUTABLE` (AC2), `CONSENT-GRANTOR`, `CONSENT-REVOKE` · **Status:** 🟡 — niezmienialność i obsługa wycofania zgód zrealizowana, widok dla bliskich w portalu poza MVP

**User story:** Jako Rodzina, chcę mieć wgląd w stan moich zgód na przetwarzanie danych z urządzeń BLE, aby zachować kontrolę nad zakresem udostępnianych informacji o samopoczuciu mojego bliskiego.

**Kryteria akceptacji:**
- **AC1 (Dostęp):** Rodzina posiada wyłącznie uprawnienie SELECT do tabeli `consent_ledger`.
- **AC2 (Zarządzanie):** Wszelkie zmiany (dodanie/wycofanie zgody) są wprowadzane przez Administratora na wniosek rodziny i zapisywane w `consent_ledger` z datą i ID osoby modyfikującej, tworząc niezmienialny rejestr zgód.

> ⚖️ **Rozstrzygnięcie (ADR-003):** zgodę wyraża pensjonariusz albo opiekun prawny, nie rodzina. Kontrakt daje odczyt rejestru opiekunowi prawnemu — rozszerzenie odczytu na rolę `family` wymaga decyzji.

### [SC-LON-01] Agenci AI do treningu kognitywnego
🔗 **Kontrakt:** brak REQ · **Status:** 🔭 — kontekst rynkowy w [`RAPORT_DOMY_SENIORA_LONGEVITY.md`](RAPORT_DOMY_SENIORA_LONGEVITY.md)

**User story:** Jako Pensjonariusz, chcę mieć dostęp do interaktywnego agenta AI, który poprowadzi ze mną krótkie treningi pamięci i ćwiczenia poznawcze, aby stymulować mój umysł i spowalniać procesy otępienne.

**Kryteria akceptacji:**
- **AC1 (Kontekstualność):** Agent AI korzysta z uproszczonego profilu podopiecznego, aby dostosować poziom trudności ćwiczeń do jego aktualnej kondycji poznawczej.
- **AC2 (Dostępność):** Treningi dostępne są poprzez interfejs głosowy (tablet/stacja dokująca), eliminując barierę obsługi dotykowej.
- **AC3 (Raportowanie):** Postępy i wyniki ćwiczeń są agregowane w profilu podopiecznego (widoczne dla personelu i rodziny jako „Wskaźnik aktywności poznawczej").

> ⚠️ **Ryzyko MDR:** cel „spowalnianie procesów otępiennych" i ocena „kondycji poznawczej" to język terapeutyczny — przed realizacją wymaga analizy granicy wyrobu medycznego.

### [SC-LON-02] Zdalny asystent głosowy (tablet/stacja przy łóżku)
🔗 **Kontrakt:** brak REQ · **Status:** 🔭

**User story:** Jako Pensjonariusz, chcę mieć możliwość zgłoszenia dyskomfortu lub prośby o pomoc za pomocą polecenia głosowego, aby nie musieć szukać fizycznego przycisku alarmowego w chwilach słabości.

**Kryteria akceptacji:**
- **AC1 (Detekcja intencji):** System rozpoznaje słowa kluczowe (np. „potrzebuję pomocy", „boli mnie", „potrzebuję wody") i automatycznie generuje ticket dla personelu w systemie.
- **AC2 (Priorytetyzacja):** Zgłoszenia głosowe są klasyfikowane w systemie triage (np. „pilne" vs „informacyjne") i wyświetlane na tablicy pielęgniarskiej.
- **AC3 (Prywatność):** Domyślnie mikrofon urządzenia jest wyciszony lub działa w trybie „local-only" (nasłuchiwanie słowa wybudzającego), z pełnym szyfrowaniem przesyłanych komend.

> ⚠️ **Ryzyko MDR / systemu ratunkowego:** produkt z definicji *nie jest systemem ratunkowym*. Zastępowanie przycisku alarmowego wymaga osobnej decyzji prawnej przed jakąkolwiek realizacją.

### [SC-LON-03] Agregator danych dla robotów asystujących (Robot-Ready API)
🔗 **Kontrakt:** brak REQ · **Status:** 🔭

**User story:** Jako Administrator, chcę, aby system udostępniał bezpieczny interfejs API dla zewnętrznych robotów asystujących, aby mogły one operować w oparciu o aktualny kontekst opiekuńczy podopiecznego (np. stan zdrowia, preferencje, historia notatek).

**Kryteria akceptacji:**
- **AC1 (Read-only API):** Dostęp dla robotów jest ograniczony do odczytu danych kontekstowych (zredagowane podsumowanie dnia, preferencje) — brak możliwości zapisu do baz danych przez roboty na tym etapie.
- **AC2 (Bezpieczeństwo):** Dostęp do API zabezpieczony kluczem OAuth2 (dedykowanym dla urządzenia/robota), z możliwością natychmiastowego zablokowania dostępu (revoke) przez Administratora.
- **AC3 (Scope):** API udostępnia tylko dane niezbędne do asystowania przy posiłkach lub lokomocji (np. „podopieczny wymaga asekuracji przy wstawaniu"), bez dostępu do historii logów medycznych.

> ⚠️ „Stan zdrowia" w treści story przeczy AC3 i granicy MDR (`MDR-NO-INTERPRETATION`) — przy podjęciu tematu kontekst dla robotów ogranicza się do preferencji i zredagowanego podsumowania.

---

## Historia zmian dokumentu

| Data | Wersja | Zmiana |
|---|---|---|
| 2026-08-25 | 2.4 | Pierwotna specyfikacja (poza repozytorium), źródło `contracts/requirements.contract.mjs`. |
| 2026-10-04 | 2.5 | Przeniesienie do repo; mapowanie na `@REQ` i ADR; dopisanie `SC-SUP-04`, `SC-ADM-10…16`, `SC-NUR-07…10`, `SC-USR-01` oraz 7 NFR z Work Orderów; oznaczenie dwóch sprzeczności jako WYMAGA DECYZJI. |
