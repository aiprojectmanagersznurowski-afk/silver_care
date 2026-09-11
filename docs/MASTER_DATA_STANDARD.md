# Standardyzacja Danych Podstawowych (Master Data) - Silver Care

## 1. Cel dokumentu
Dokument ten definiuje strukturę, nazewnictwo oraz zasady zarządzania Danymi Podstawowymi (Master Data) w systemie Silver Care. Stanowi on fundament dla dalszej standaryzacji cech danych, projektowania kontraktów (API) oraz struktury bazy danych. Dokument uwzględnia specyfikę prawną i biznesową produktu (narzędzie komunikacji i organizacji życia placówki, a **nie wyrób medyczny**).

## 2. Ubiquitous Language (Słownik Pojęć)

### ✅ Dozwolone i Wymagane Pojęcia
* **Resident (Pensjonariusz):** Osoba przebywająca w placówce opiekuńczej.
* **Organization (Placówka/Organizacja):** Podmiot świadczący usługi opiekuńcze.
* **Family / Guardian (Bliski / Opiekun prawny):** Osoba powiązana z pensjonariuszem. Zgody z art. 9 RODO wyraża wyłącznie opiekun prawny lub sam pensjonariusz (nigdy zwykła rola `family`).
* **Staff (Personel):** Pracownicy placówki mający dostęp do pełnych danych telemetrycznych i organizacyjnych.
* **Report (Raport):** Podsumowanie udostępniane bliskim. Publikacja raportu jest **jedynym** wyzwalaczem powiadomień w systemie.
* **External Wearable Link:** Powiązanie pensjonariusza z zewnętrznym dostawcą urządzeń (np. opasek).
* **Activity / Metrics (Aktywność / Metryki):** Zbierane parametry.

### 🚫 Zakazane Pojęcia (Porzucone / Niedozwolone)
* `Patient` (Pacjent) - całkowity zakaz w warstwie UI oraz nazewnictwie zmiennych.
* `Care Home` (Dom opieki) - architektura opiera się na pojęciu `Organization`.
* `Polar User ID` - zastąpione abstrakcją `External Wearable Link`.
* **Diagnozy medyczne** (np. "podejrzenie omdlenia") - system nie formułuje diagnoz. Zamiast tego komunikuje fakty: np. "brak aktywności od X godzin".

## 3. Główne Encje Master Data (Core Entities)

### 3.1. Organization
Reprezentuje placówkę opiekuńczą. Jest to najwyższy poziom hierarchii w systemie dziedzinowym.
* **Klucz główny:** UUID
* **Dane powiązane:** Linki do zewnętrznych systemów organizacyjnych (`external_org_links`).

### 3.2. Resident
Reprezentuje pensjonariusza przypisanego do Organizacji.
* **Klucz główny:** UUID (dostarczany z frontendu, nigdy nie odgadywany z nagrań przez modele AI).
* **Poufność:** Brak bezpośredniego logowania danych osobowych (PII). PESEL przechowywany wyłącznie w formie zanonimizowanej jako `pesel_hash`.
* **Główne relacje:** Powiązany z `Organization`, użytkownikami typu `Family/Guardian` oraz `external_wearable_links`.

### 3.3. User (Role Użytkowników)
Osoby logujące się do systemu.
* **Identyfikator:** UUID
* **Dostępne Role:**
  * `staff` - pełen dostęp do danych surowych.
  * `family` - dostęp read-only do raportów i ogólnych metryk. Brak uprawnień do zarządzania zgodami.
  * `guardian` - uprawnienia `family` poszerzone o zarządzanie zgodami (Art. 9).
* **Zasada bezpieczeństwa:** Klucz `service_role` **nigdy** nie jest przesyłany ani eksponowany w warstwie klienta (frontend).

### 3.4. Wearable & External Links
Integracja z urządzeniami monitorującymi.
* **Encje:** `external_wearable_links`, `external_org_links`
* **Cel:** Izolacja systemu od specyficznych vendorów sprzętu (brak twardych zależności do konkretnych producentów w rdzeniu).

### 3.5. Consent Registry (Rejestr Zgód)
Rejestr zgód na przetwarzanie danych szczególnych kategorii (Art. 9).
* **Charakterystyka:** Niezmienny rejestr audytowy (immutable / append-only). Nikt nie modyfikuje wpisów historycznych.

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
1. `MEDICAL` - Dane czysto medyczne. Odfiltrowywane i pozostawiane wyłącznie w prywatnym brudnopisie personelu.
2. `DISCOMFORT` - Ograniczone do ogólnego opisu w raporcie dla bliskich.
3. `BEHAVIORAL` - Stanowią główną treść i podstawę generowania raportów.

## 6. Procedury Zarządzania Kontraktem
Wszelkie zmiany w strukturze Master Data, przed zaimplementowaniem ich w kodzie, muszą:
1. Zostać zaplanowane w ramach pętli produkcyjnej (PLAN → CONTRACT → RED → GREEN → VERIFY...).
2. Zostać zapisane w kontraktach (`contracts/*.contract.mjs`). Narzędzie CLI (`node tools/sc-contract-window.mjs open <REQ-ID>`) służy do formalnego otwierania zmian. Kod zawsze importuje schematy z `@silvercare/contracts`.
