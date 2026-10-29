# Standardyzacja Danych Podstawowych (Master Data) - Silver Care

> **Wersja:** 2.0 (2026-10-29): słownik terminów UI z preferowanymi nazwami i zakazanymi synonimami, role z kontraktu, struktura i pojemność placówki, pojęcia zmiany i zadań. Decyzje terminologiczne: Michał, 2026-10-29. Story: `NFR-UI-06`.

## 1. Cel dokumentu
Dokument ten definiuje strukturę, nazewnictwo oraz zasady zarządzania Danymi Podstawowymi (Master Data) w systemie Silver Care. Stanowi on fundament dla dalszej standaryzacji cech danych, projektowania kontraktów (API) oraz struktury bazy danych. Dokument uwzględnia specyfikę prawną i biznesową produktu (narzędzie komunikacji i organizacji życia placówki, a **nie wyrób medyczny**).

**Hierarchia źródeł:** przy sprzeczności wygrywa kontrakt (`contracts/*.contract.mjs`). Nazwy ról pochodzą z `ROLES.label` w `roles.contract.mjs`, struktura placówki z `facility.contract.mjs`. Docelowo słownik z sekcji 2 trafia do kontraktu (`presentation.contract.mjs`), a reguła bramki pilnuje tekstów UI, tak jak dziś blokuje słowo „pacjent”.

## 2. Ubiquitous Language (Słownik Pojęć)

### 2.1. Terminy w interfejsie (UI)

| Encja (kod) | Termin w UI | Zakazane synonimy w UI | Uwagi |
|---|---|---|---|
| `residents` | **podopieczny** | pacjent (bezwzględnie), pensjonariusz, mieszkaniec, rezydent | „pensjonariusz” wyłącznie w dokumentach formalnych: umowa, klauzule RODO, rejestr zgód. „Senior” dopuszczalny w tekstach opisowych dla bliskich |
| `organizations` | **placówka** | ośrodek, dom opieki, DPS, zakład | „sieć placówek” dla widoku wielu placówek super admina |
| `rooms`, `beds` | **struktura placówki**: piętro, sektor, pokój, łóżko | struktura ośrodka | patrz 3.6 |
| `organizations.resident_limit` | **limit miejsc** | pojemność, limit pensjonariuszy | 1 miejsce = 1 łóżko = 1 podopieczny (patrz 3.6) |
| `daily_reports` | **raport** (dla bliskich: „raport dnia”) | Peace Letter, list | publikacja raportu to jedyny wyzwalacz powiadomień dla bliskich |
| `daily_logs` | **notatki personelu** | brudnopis (tylko w dokumentacji technicznej) | nigdy niewidoczne dla bliskich |
| `daily_agenda` / `agenda_items` | **plan dnia** | harmonogram, grafik | „grafik” zarezerwowany dla grafiku zmian (3.7) |

Pisownia w tytułach i etykietach: **zdaniowa**, czyli „Struktura placówki”, a nie „Struktura Placówki”. Wielka litera tylko na początku i w nazwach własnych.

### 2.2. Pozostałe pojęcia dozwolone
* **Bliski / Opiekun prawny** (Family / Guardian): osoba powiązana z podopiecznym. Zgody z art. 9 RODO wyraża wyłącznie opiekun prawny albo sam podopieczny (nigdy zwykła rola `family`).
* **Personel** (Staff): pracownicy placówki (`org_admin`, `nurse`).
* **Powiązanie z opaską** (External Wearable Link): powiązanie podopiecznego z zewnętrznym dostawcą urządzeń.
* **Aktywność / Metryki**: zbierane parametry, prezentowane jako fakty (sekcja 4).

### 2.3. Pojęcia zakazane (porzucone / niedozwolone)
* `Patient` (Pacjent): całkowity zakaz w warstwie UI oraz w nazewnictwie zmiennych, łącznie z odmianą.
* `Care Home` (Dom opieki), `care_homes`: architektura opiera się na pojęciu `Organization`. Dozwolone wyłącznie w warstwie integracyjnej.
* `Polar User ID`, `polar_user_id`: zastąpione abstrakcją `External Wearable Link`.
* **Ośrodek**: w UI zastępuje go „placówka” (decyzja Michała, 2026-10-29).
* **Diagnozy medyczne** (np. „podejrzenie omdlenia”): system nie formułuje diagnoz. Zamiast tego komunikuje fakty, np. „brak aktywności od X godzin”.

## 3. Główne Encje Master Data (Core Entities)

### 3.1. Organization (Placówka)
Reprezentuje placówkę opiekuńczą. Jest to najwyższy poziom hierarchii w systemie dziedzinowym.
* **Klucz główny:** UUID
* **Limit miejsc:** `resident_limit`, ustawiany wyłącznie przez super admina (patrz 3.6).
* **Dane powiązane:** Linki do zewnętrznych systemów organizacyjnych (`external_org_links`).

### 3.2. Resident (Podopieczny)
Reprezentuje podopiecznego przypisanego do placówki.
* **Klucz główny:** UUID (dostarczany z frontendu, nigdy nie odgadywany z nagrań przez modele AI).
* **Poufność:** Brak bezpośredniego logowania danych osobowych (PII). PESEL przechowywany wyłącznie w formie zanonimizowanej jako `pesel_hash`.
* **Format imienia i nazwiska:** „Nazwisko Imię”, wyłącznie przez `formatPersonName` (`lib/person-name`).
* **Główne relacje:** Powiązany z `Organization`, użytkownikami typu `Family/Guardian` oraz `external_wearable_links`.

### 3.3. User (Role Użytkowników)
Osoby logujące się do systemu. **Nazwy ról w UI wyłącznie z kontraktu (`ROLES.label`)**:

| Rola (kod) | Nazwa w UI | Zakres | Zakazane nazwy w UI |
|---|---|---|---|
| `super_admin` | **Administrator platformy** | wszystkie placówki | — |
| `org_admin` | **Kierownik placówki** | własna placówka | Administrator Ośrodka, administrator placówki, admin |
| `nurse` | **Personel opiekuńczy** | własna placówka | pielęgniarka (jako nazwa roli), opiekun (myli się z opiekunem prawnym) |
| `legal_guardian` | **Opiekun prawny** | powiązany podopieczny | — |
| `family` | **Członek rodziny** | powiązany podopieczny | — |

* **Zgody:** wyrażają wyłącznie `resident_self` i `legal_guardian` (`CONSENT_GRANTORS`). Rola `family` nie wyraża ani nie cofa zgód.
* **Zasada bezpieczeństwa:** Klucz `service_role` **nigdy** nie jest przesyłany ani eksponowany w warstwie klienta (frontend).

### 3.4. Wearable & External Links
Integracja z urządzeniami monitorującymi.
* **Encje:** `external_wearable_links`, `external_org_links`
* **Cel:** Izolacja systemu od specyficznych vendorów sprzętu (brak twardych zależności do konkretnych producentów w rdzeniu).

### 3.5. Consent Registry (Rejestr Zgód)
Rejestr zgód na przetwarzanie danych szczególnych kategorii (Art. 9).
* **Charakterystyka:** Niezmienny rejestr audytowy (immutable / append-only). Nikt nie modyfikuje wpisów historycznych. Cofnięcie zgody to nowy stan przez `revoked_at`.

### 3.6. Struktura placówki i limit miejsc
Hierarchia (`FACILITY_HIERARCHY` w `facility.contract.mjs`): **placówka → piętro → sektor → pokój → łóżko**. Piętro i sektor są atrybutami pokoju, nie łóżka.

* **Łóżko:** jedno łóżko, jeden aktywny podopieczny jednocześnie (ADR-012).
* **Limit miejsc:** `organizations.resident_limit` to maksymalna liczba łóżek, a tym samym maksymalna liczba podopiecznych (decyzja Michała, 2026-10-29).
  * Ustawia go i zmienia **wyłącznie super admin**.
  * Kierownik placówki **może przekroczyć** limit (dodając łóżka albo przyjmując podopiecznych), ale wtedy **kierownik i super admin dostają ostrzeżenie**. Szczegóły w story `SC-ADM-22`.
  * Ostrzeżenie o przekroczeniu nie jest oceną stanu podopiecznych, więc bez czerwieni (czerwień tylko dla błędów technicznych).
* **Obłożenie:** liczba aktywnych przypisań łóżek / limit miejsc. Pole pochodne, nigdy wpisywane ręcznie (tak jak `bed_count`).

### 3.7. Zmiany, przekazanie i zadania (📝 PROPOZYCJA, ADR-021)

| Pojęcie | Znaczenie | Uwagi |
|---|---|---|
| **zmiana** | okres pracy personelu, 2 lub 3 na dobę, strefa `Europe/Warsaw` | „dyżur” dopuszczalny w tekstach opisowych |
| **grafik zmian** | kto pracuje na zmianie i kto jest liderem zmiany | nie mylić z „planem dnia” |
| **przekazanie zmiany** | raport dla następnej obsady, tylko dla personelu | nigdy dla bliskich |
| **zadanie** | polecenie personelu dla podopiecznego albo placówki, przypisane do osoby albo do zmiany | propozycja AI ma status „proponowane” do akceptacji człowieka |
| **backlog zadań** | niewykonane zadania przechodzące na kolejne zmiany | nie są automatycznie odrzucane |
| **wymaga uwagi** | znacznik podopiecznego z otwartym zadaniem albo ustawiony ręcznie | nigdy ocena modelu |

## 4. Zasady Klasyfikacji i Prezentacji Danych Telemetrycznych

Z uwagi na charakter systemu, dane z urządzeń posiadają sztywny podział widoczności:

### 🟢 Zestaw A: Widoczne dla Bliskich (Family) i Personelu (Staff)
* Kroki (Steps)
* Czas aktywności (Activity time)
* Długość snu (Sleep duration)
* Godziny snu (Sleep schedule)

### 🔴 Zestaw B: Widoczne TYLKO dla Personelu (Staff) - Ukryte przed Bliskimi
* Tętno (Heart rate / HR)
* Zmienność rytmu serca (HRV)
* Tętno spoczynkowe (Resting heart rate)
* Wynik jakości snu (Sleep score)

## 5. Przetwarzanie Potoku Głosowego (Voice Pipeline)
Dane głosowe przed przetworzeniem przez model przechodzą przez 3 strumienie klasyfikacyjne:
1. `MEDICAL` - Dane czysto medyczne. Odfiltrowywane i pozostawiane wyłącznie w notatkach personelu (`daily_logs`).
2. `DISCOMFORT` - Ograniczone do ogólnego opisu w raporcie dla bliskich.
3. `BEHAVIORAL` - Stanowią główną treść i podstawę generowania raportów.

## 6. Procedury Zarządzania Kontraktem
Wszelkie zmiany w strukturze Master Data, przed zaimplementowaniem ich w kodzie, muszą:
1. Zostać zaplanowane w ramach pętli produkcyjnej (PLAN → CONTRACT → RED → GREEN → VERIFY...).
2. Zostać zapisane w kontraktach (`contracts/*.contract.mjs`). Narzędzie CLI (`node tools/sc-contract-window.mjs open <REQ-ID>`) służy do formalnego otwierania zmian. Kod zawsze importuje schematy z `@silvercare/contracts`.
