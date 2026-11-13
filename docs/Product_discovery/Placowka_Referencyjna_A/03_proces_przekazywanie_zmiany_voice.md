# Specyfikacja Procesu 2: Przekazywanie Zmiany i Raportowanie Głosowe AI (Handover Voice-to-Text & Logbook)

**Lokalizacja obiektu:** Placówka Referencyjna A  
**Rola analityczna:** Starszy Analityk Biznesowy & Inżynier Systemowy  
**Status dokumentu:** Zatwierdzona Specyfikacja Wymagań i Architektury Procesu  

---

## 1. Cel i Zakres Procesu

Proces przekazania dyżuru (handover) jest najbardziej newralgicznym punktem styku operacyjnego w 24-godzinnym cyklu życia placówki. Występuje dwa razy na dobę:
* **Poranny Handover:** 06:30 – 07:15 (Nocka zdaje Dniówce).
* **Wieczorny Handover:** 18:30 – 19:15 (Dniówka zdaje Nocce).

Celem przeprojektowania procesu jest eliminacja ograniczeń tradycyjnego, papierowego zeszytu raportów poprzez wdrożenie wielojęzycznego systemu **Voice-to-Text z automatyczną kategoryzacją AI**, centralnym **Rejestrem Przekazań (Handover Logbook)** oraz interaktywną tablicą odpraw na monitorze w dyżurce.

---

## 2. Model Procesu Obecnego (AS IS)

### 2.1. Charakterystyka Pracy z Zeszytem Raportów
* **Jeden egzemplarz fizyczny:** W dyżurce znajduje się pojedynczy, oprawny brulion („podręczny zeszyt operacyjny”).
* **Rygor niebieskiego długopisu:** Zmiana dzienna ma formalny nakaz dokonywania wpisów wyłącznie niebieskim tuszem (nocka pisze czerwonym). Wpisy zawierają: stan ewidencyjny mieszkańców, stan obecnych w obiekcie, liczbę osób hospitalizowanych oraz listę incydentów per pokój/nazwisko.
* **Zmęczenie fizyczne i presja czasu:** Po 12 godzinach wyczerpującej pracy fizycznej (dźwiganie podopiecznych, toalety, kąpiele, karmienie) opiekunki schodzące mają zaledwie kilkanaście minut na spisanie raportu. W efekcie notatki są zredukowane do absolutnego minimum.
* **Bariera językowa:** Istotną część personelu opiekuńczego stanowią pracownice wielojęzyczne (posługujące się na co dzień językiem wschodniosłowiańskim / UA). Mimo sprawnej komunikacji werbalnej, konieczność formułowania pisemnych, precyzyjnych notatek w języku polskim powoduje dyskomfort, stres i pomijanie subtelnych, lecz kluczowych obserwacji behawioralnych.
* **„Wygadanie się” (kanał nieformalny):** Opiekunki uzupełniają braki zeszytu intensywną rozmową ustną podczas 30-minutowej zakładki zmianowej. Niestety, wiedza przekazana ustnie ulatuje po kilkunastu minutach, nie trafia do personelu nieobecnego danego dnia i nie stanowi trwałego śladu audytowego.

### 2.2. Diagram Procesu AS IS

```mermaid
flowchart TD
    subgraph Koniec_Zmiany["Koniec Zmiany (06:30 / 18:30)"]
        Schodzaca["Opiekunki schodzące ze zmiany<br/>(Zmęczenie fizyczne po 12h dyżuru)"]
        Bariera["Bariera językowa i pośpiech<br/>(Personel wielojęzyczny PL/UA - trudność z precyzyjnym zapisem PL)"]
    end

    subgraph Narzedzie_AS_IS["Tradycyjny Zeszyt Operacyjny (AS IS)"]
        Zeszyt["Jeden papierowy zeszyt dyżurki<br/>(Wpisy niebieskim długopisem)"]
        Wpisy_Wybiorcze["Zapisywane tylko wybrane incydenty<br/>(Brak szablonu, lakoniczne notatki)"]
        Ustne_Info["Ustny przekaz przy kawie/w drzwiach<br/>(Przekaz nieformalny)"]
    end

    subgraph Ryzyka_I_Straty["Utrata Informacji i Ryzyka Operacyjne"]
        Utrata["Informacje ustne ulatują po 15 minutach<br/>(Brak śladu audytowego)"]
        Brak_Szukania["Brak możliwości przeszukania historii podopiecznego<br/>(Przekartkowywanie setek stron zeszytu)"]
        Zeszyt_Zniszczenie["Zeszyt może zaginąć lub ulec zniszczeniu<br/>(Brak kopii zapasowej)"]
        Przyjmujaca["Nowa zmiana nie ma pełnego obrazu nocy/dnia<br/>Ryzyko powtórzenia błędu lub pominięcia zaleceń"]
    end

    Schodzaca --> Bariera
    Bariera --> Wpisy_Wybiorcze
    Bariera --> Ustne_Info
    Wpisy_Wybiorcze --> Zeszyt
    Ustne_Info --> Utrata

    Zeszyt --> Brak_Szukania
    Zeszyt --> Zeszyt_Zniszczenie
    Utrata --> Przyjmujaca
    Brak_Szukania --> Przyjmujaca
```

### 2.3. Wąskie Gardła i Ryzyka Formalne Stanu AS IS
1. **Brak przeszukiwalności przy wymogach dowodowych wobec rodzin:** Zeszyt dyżurki pełni rolę wewnętrznej dokumentacji dowodowej zapewniającej rozliczalność wobec rodzin (ochronę przed roszczeniami). Odszukanie w papierowym brulionie zdarzenia sprzed 4 miesięcy (np. wyjaśnienie okoliczności odleżyny czy upadku) wymaga wielogodzinnego wertowania stron.
2. **Ryzyko utraty lub uszkodzenia fizycznego:** Zeszyt leżący na blacie w dyżurce jest narażony na zalanie kawą, zniszczenie lub zagubienie, co oznacza bezpowrotną utratę historii operacyjnej.
3. **Brak możliwości zdalnego wglądu kierownictwa:** Kierownik Operacyjny ani Koordynatorka Opieki nie mają dostępu do raportów poza dyżurką – aby poznać przebieg nocy, muszą wykonywać telefony do opiekunek.

---

## 3. Wymagania Wejściowe i Funkcjonalne do Procesu Docelowego (TO BE)

System raportowania głosowego opiera się na 5 filarach technologicznych i funkcjonalnych (zgodnie z architekturą docelową `docs/architecture/VOICE_SHIFT_REPORTING_PIPELINE.md`):

### 3.1. Prosty Interfejs Rejestracji Głosu w Dyżurce
* **Sprzęt:** Dedykowany tablet/telefon z aplikacją SilverCare lub rejestrator mobilny Zero-UI (M5StickC PLUS2).
* **Ergonomia „One-Touch”:** Opiekunka loguje się na swoje konto (lub korzysta z przypisanego urządzenia), wybiera podopiecznego albo nagrywa w trybie dyktafonu (kolejka „Do przypisania”) i naciska duży, czytelny przycisk nagrywania.
* **Brak ograniczeń językowych:** Pracownica mówi swobodnie w języku ojczystym (**PL lub UA**).

### 3.2. Silnik Przetwarzania Mowy i Tłumaczenia (Speech-to-Text & Translation)
* **Model Transkrypcyjny:** Wykorzystanie zoptymalizowanego modelu mowy (Whisper Large v3 / Whisper Turbo) o wysokiej odporności na szum tła dyżurki i akcent.
* **Automatyczne Tłumaczenie i Normalizacja:** Silnik LLM tłumaczy wypowiedź z języka ojczystego (UA) na profesjonalny język polski, standaryzując terminologię opiekuńczą (np. „cukier”, „ciśnienie”, „pampers”, „odleżyna”, „barierki”).

### 3.3. Przypisanie Podopiecznego i Automatyczna Kategoryzacja
1. **Przypisanie podopiecznego (`VOICE-ZERO-GUESSING`):** Model AI nigdy nie zgaduje tożsamości. Podopieczny jest wybierany w aplikacji przed nagraniem albo dopasowywany deterministycznie po stronie serwera (po imieniu, nazwisku, pokoju) i potwierdzany przez Kierownika Zmiany w kolejce „Do przypisania” przed wysłaniem zamaskowanego tekstu do modelu.
2. **Kategoryzacja zdarzeń i strumieni:**
   * `[INCIDENT]` – Upadek, uraz, rana, agresja słowna/fizyczna, awaria sprzętu.
   * `[LEK_ODMOWA]` – Odmowa przyjęcia leków, trudności w połykaniu, wymioty po leku (`medication_event`).
   * `[PARAMETR_POMIAR]` – Odnotowane parametry życiowe (ciśnienie, glikemia, temperatura).
   * `[HIGIENA_SKORA]` – Zaczerwienienia, pielęgnacja skóry, nadmierne zużycie materiałów chłonnych.
   * `[BEHAWIORALNE]` – Niepokój nocny, próby wspinania się przez barierki łóżka, pobudzenie demencyjne.
   * `[ZADANIE_DLA_NASTEPNEJ_ZMIANY]` – Propozycja zadania (`PROPOSED`) z cytatem źródłowym (np. *„skontrolować ciśnienie o 11:00”*, *„przygotować do wizyty córki o 15:00”*).

### 3.4. Rejestr Przekazań (Handover Logbook)
Centralny, niezmienny (append-only) cyfrowy rejestr raportów:
* **Metadane:** Unikalny ID wpisu, data i godzina nagrania (`recorded_at`), ID autora, identyfikator zmiany (Dniówka/Nocka), załączony plik audio.
* **Treść:** Oryginalny transkrypt + znormalizowane tłumaczenie w języku polskim + wyekstrahowane kategorie.
* **Cyfrowe zatwierdzenie (Acknowledge):** Kierownik Zmiany zatwierdza raport, a następna zmiana potwierdza odbiór dyżuru jednym kliknięciem.

---

## 4. Model Procesu Docelowego (TO BE)

### 4.1. Architektura Przepływu Informacji

```mermaid
flowchart TD
    subgraph Wejscie_Glosowe["Rejestracja Mowy (TO BE)"]
        Pracownik["Opiekunka / Salowa zdająca zmianę<br/>(ID pracownika, zmiana: Dzień/Noc)"]
        Nagranie["Nagranie notatki głosowej (Aplikacja / Stick)<br/>- Mowa w języku ojczystym (PL lub UA)<br/>- Szybkie mówienie bez oporów przed pisaniem"]
    end

    subgraph Silnik_AI["Pipeline Przetwarzania Mowy i AI"]
        Whisper["1. Speech-to-Text (Whisper Engine)<br/>Precyzyjna transkrypcja mowy na tekst"]
        Assign["2. Przypisanie Podopiecznego i Maskowanie PII<br/>Wybór z UI lub potwierdzenie Kierownika Zmiany"]
        LLM_Categorizer["3. Tłumaczenie UA->PL i Klasyfikacja (LLM)<br/>- Strumienie MEDICAL / DISCOMFORT / BEHAVIORAL<br/>- Propozycje zadań z cytatem źródłowym"]
    end

    subgraph Warstwa_Danych["Centralny Rejestr Przekazań (Handover Logbook)"]
        Karta_Podopiecznego["Cyfrowa Karta Podopiecznego<br/>(Wpis zasila historię konkretnego seniora)"]
        Rejestr_Zmian["Rejestr Przekazania Zmiany<br/>(Kto, kiedy, nagranie audio, transkrypcja, tłumaczenie)"]
        Task_Generator["Propozycje Zadań Zmiany (PROPOSED)<br/>(np. 'Zmierzyć ciśnienie o 10:00 - pan Jan')"]
    end

    subgraph Wyjscie_I_Nadzor["Konsumpcja Danych na Nowej Zmianie"]
        Monitor_Dyżurka["Duży Monitor w Dyżurce (Dashboard)<br/>- Alerty o lekach i zdarzeniach z nocy/dnia<br/>- Lista zadań dla wchodzącej zmiany"]
        Zatwierdzenie["Cyfrowe Potwierdzenie Handoveru<br/>(Zatwierdzenie i potwierdzenie odbioru raportu)"]
        Online["Dostęp Kierownictwa Online<br/>(Kierownik Operacyjny / Koordynatorka widzą stan zdalnie)"]
    end

    Pracownik --> Nagranie
    Nagranie --> Whisper
    Whisper --> Assign
    Assign --> LLM_Categorizer

    LLM_Categorizer --> Karta_Podopiecznego
    LLM_Categorizer --> Rejestr_Zmian
    LLM_Categorizer --> Task_Generator

    Rejestr_Zmian --> Monitor_Dyżurka
    Task_Generator --> Monitor_Dyżurka
    Monitor_Dyżurka --> Zatwierdzenie
    Rejestr_Zmian --> Online
```

---

## 5. Przykładowy Scenariusz Operacyjny (End-to-End)

Poniższy przypadek demonstruje działanie pipeline'u przy zdaniu dyżuru przez opiekunkę posługującą się językiem ojczystym (UA):

### 5.1. Krok 1: Wejście Głosowe (Mowa w języku ojczystym UA)
> **Opiekunka Oksana (godz. 06:45, dyżur nocny):**  
> *„Зміна нічна пройшла в цілому спокійно. Але в кімнаті 8 у пана Тадеуша десь о другій ночі був сильний неспокій, хотів перелізти через перила ліжка. Ми дали йому заспокійливий чай і поправили ковдру. А в кімнаті 14 у пані Яніни о 4 ранку при зміні памперса помітили сильне почервоніння на лівому стегні, треба щоб денна зміна обов'язково показала це лікарці у вівторок і поміряла тиск о 10 ранку, бо вночі було 160 на 95.”*

### 5.2. Krok 2: Automatyczna Transkrypcja i Tłumaczenie (PL)
> **Znormalizowany raport w języku polskim:**  
> *„Zmiana nocna przebiegła zasadniczo spokojnie. W pokoju nr 8 u pana Tadeusza około godziny 02:00 wystąpił silny niepokój psychoruchowy – podjął próbę przejścia przez barierki łóżka. Zastosowano wyciszenie i asekurację. W pokoju nr 14 u pani Janiny o godzinie 04:00 podczas wymiany pampersa zaobserwowano silne zaczerwienienie lewego biodra. Zlecono kontrolę lekarską podczas wtorkowej wizyty POZ oraz wykonanie pomiaru ciśnienia tętniczego o godz. 10:00 (w nocy odnotowano RR 160/95 mmHg).”*

### 5.3. Krok 3: Wygenerowane Struktury Danych i Zadania

#### Zdarzenie 1: Profil Podopiecznego (Tadeusz Kowalczyk, Pokój 8)
* **Kategoria:** `[BEHAWIORALNE]`, `[BEZPIECZEŃSTWO]`
* **Treść:** Próba forsowania barierek łóżka, niepokój nocny o godz. 02:00.
* **Status:** Wyciszony, bez urazu.

#### Zdarzenie 2: Profil Podopiecznej (Janina Zielińska, Pokój 14)
* **Kategoria:** `[HIGIENA_SKÓRA]`, `[PARAMETR_POMIAR]`
* **Odnotowane parametry:** RR 160/95 mmHg (godz. 04:00).
* **Zadanie do konsultacji:** *Pokój 14 – Zaczerwienienie biodra + zgłoszenie do Lekarza POZ na wtorek.*
* **Propozycja zadania dla Dniówki:** *Zmierzyć RR o 10:00 (przypisane do zmiany dziennej).*

---

## 6. Prezentacja Danych na Monitorze Dyżurki

Podczas porannej kawy i handoveru (06:45–07:15) zmiana dzienna widzi na dużym ekranie ściennym:
1. **Licznik Doby:** Obecnych: 96 | Hospitalizowanych: 4 | Zgony w nocy: 0.
2. **Tablica Zdarzeń Zmiany (Shift Alerts):**
   * Wykaz podopiecznych z odnotowanymi zdarzeniami z nocy.
   * Lista podopiecznych, którzy odmówili przyjęcia leków wieczornych/nocnych (`MedicationAlertBanner`).
3. **Lista Przekazanych Zadań (Handover Tasks):**
   * Wygenerowane zadania z nocnych notatek głosowych (kontrole parametrów, opatrunki, przygotowania do transportu).
4. **Przycisk Zatwierdzenia Dyżuru:** Podpis Kierownika Zmiany po zapoznaniu się z raportem głosowym.

---

## 7. Korzyści Biznesowe i Operacyjne Wdrożenia

1. **Oszczędność czasu personelu:** Nagranie notatki głosowej zajmuje **60 sekund** zamiast 15–20 minut żmudnego, ręcznego pisania w zeszycie.
2. **Zniesienie bariery językowej:** Wielojęzyczny personel opiekuńczy (PL/UA) raportuje bez stresu, przekazując 3-krotnie więcej detali opiekuńczych.
3. **Cyfrowa tarcza dowodowa dla placówki:** Każdy raport posiada nienaruszalny znacznik czasu, ID pracownika oraz oryginalne nagranie audio, co zapewnia pełną rozliczalność i ochronę przed roszczeniami.
4. **Natychmiastowy wgląd kierownictwa:** Kierownik Operacyjny może w dowolnym momencie z poziomu telefonu sprawdzić stan placówki bez konieczności niepokojenia dyżurki telefonami.
