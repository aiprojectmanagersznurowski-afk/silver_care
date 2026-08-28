# Silver Care — reguły stałe

## Reguła nadrzędna

**Kontrakt w `contracts/*.contract.mjs` jest jedynym źródłem prawdy.** Role, uprawnienia, granica prezentacji, potok głosowy, mapowania integracji, katalog powiadomień i rejestr wymagań mieszkają tam i nigdzie indziej. Kod importuje z `@silvercare/contracts`, nie przepisuje wartości.

Nie edytuj `contracts/` ani `packages/contracts/src/generated/` bez otwartego okna kontraktowego:

```bash
node tools/sc-contract-window.mjs open <REQ-ID>
```

## Czym jest ten produkt, a czym nie jest

Silver Care to **narzędzie komunikacji i organizacji codziennego życia placówki**. Nie jest wyrobem medycznym, systemem ratunkowym ani monitoringiem stanu zdrowia. To nie jest deklaracja marketingowa — to przewidziane zastosowanie, od którego zależy klasyfikacja prawna całego produktu.

Praktyczne konsekwencje w kodzie:

- **Bliscy widzą metryki behawioralne**: kroki, długość snu, czas aktywności, godziny snu. Nic więcej.
- **Bliscy nie widzą parametrów fizjologicznych**: tętna, HRV, tętna spoczynkowego, wyniku snu. Te dane są zbierane i dostępne personelowi — zakaz dotyczy prezentacji, nie przechowywania.
- **System nie ocenia stanu zdrowia.** Wolno napisać „brak aktywności od czterech godzin". Nie wolno napisać „podejrzenie omdlenia".
- **Żadna metryka nie wyzwala powiadomienia.** Jedynym wyzwalaczem jest publikacja raportu zatwierdzonego przez personel.
- **Słowo „pacjent" jest zakazane w warstwie widocznej dla użytkownika**, łącznie z odmianą („o pacjencie"). Używaj: podopieczny, senior, pensjonariusz.

## Dane osobowe i zdrowotne

Wszystko, co dotyczy pensjonariusza, to dane szczególnej kategorii z artykułu 9 RODO. Z tego wynika:

- **Zgodę może wyrazić wyłącznie pensjonariusz albo jego opiekun prawny.** Rola `family` nie może wyrażać ani cofać zgód — to dwie różne role, nie dwa odcienie tej samej.
- **Rejestr zgód i rejestr audytowy są niezmienialne.** Cofnięcie zgody to nowy stan przez `revoked_at`, nie edycja wiersza.
- **Nie loguj danych osobowych.** Wolno logować `residentId` jako UUID i kody techniczne. Nie wolno logować obiektów z treścią notatek, imionami, PESEL-em.
- **PESEL wyłącznie jako `pesel_hash`.** Brak wartości jawnej w bazie, w logach i w treści zaproszeń.
- **Klucz `service_role` omija RLS** i nie ma prawa pojawić się w warstwie klienta.

## Potok głosowy

Transkrypt dzieli się na trzy strumienie **zanim** trafi do modelu:

1. `MEDICAL` — leki, diagnozy, wyniki badań, parametry życiowe. Usuwane z transkryptu przed wysłaniem do LLM. Zapisywane wyłącznie w brudnopisie personelu.
2. `DISCOMFORT` — zdarzenia naruszające godność. Oryginał w brudnopisie, do raportu trafia ogólny opis.
3. `BEHAVIORAL` — podstawa raportu dla bliskich.

Model **nigdy** nie ustala tożsamości pensjonariusza z nagrania. Frontend przekazuje `resident_id` jako UUID, transkrypt idzie do modelu anonimowy, złączenie następuje w pamięci funkcji brzegowej przed zapisem. Brak identyfikatora w żądaniu kończy się odmową, nie próbą rozpoznania.

## Rdzeń i warstwa integracyjna

Rdzeń nazywa się `organizations` i `residents`. Identyfikatory dostawców nie mieszkają na tabelach rdzenia — żyją w `external_wearable_links` i `external_org_links`. Nazwy `care_homes`, `patients` i `polar_user_id` są porzucone i dozwolone wyłącznie w warstwie integracyjnej.

Powód: jeden pensjonariusz może jutro mieć drugie urządzenie innego producenta. Gdyby `polar_user_id` siedział na rekordzie seniora, każdy nowy dostawca oznaczałby migrację rdzenia.

## Pętla pracy

```
PLAN → CONTRACT (jeśli trzeba) → RED → GREEN → VERIFY → REVIEW → INTEGRATE
```

W fazie RED powstaje wyłącznie test i musi być czerwony. W fazie GREEN wyłącznie implementacja. Sprawdzenie granicy faz:

```bash
node tools/sc-phase.mjs red    # albo green, albo contract
```

Każdy test niesie znacznik `@REQ: <ID>` wskazujący wymaganie z rejestru. Test bez znacznika nie przechodzi bramki.

## Zanim zamkniesz zadanie

```bash
bash scripts/verify.sh --full
```

Etap oznaczony jako POMINIĘTY to brak dowodu, a nie sukces. Jeżeli bramka nie mogła się wykonać, powiedz to wprost zamiast raportować zieleń.

## Tryb autonomiczny (ADR-010)

**Pracujesz samodzielnie. Nie pytasz o rzeczy, które możesz rozstrzygnąć sam.**

Każdą napotkaną niejednoznaczność klasyfikujesz do jednej z trzech klas z `autonomy.contract.mjs`:

**AUTO** — decyzja techniczna, odwracalna, bez wpływu na dane osobowe i granice prawne. Wybierz opcję rekomendowaną, odnotuj jednym zdaniem w podsumowaniu, kontynuuj. Nazwy zmiennych, struktura katalogów, obsługa błędu technicznego, podział komponentu.

**AUTO_LOGGED** — decyzja projektowa o trwałych skutkach, ale mieszcząca się w kontrakcie. Wybierz opcję rekomendowaną, zapisz decyzję i odrzuconą alternatywę w `docs/decisions/AUTO-<data>.md`, kontynuuj. Kształt tabeli pomocniczej, strategia buforowania, wybór między dwoma poprawnymi sposobami spełnienia kryterium.

**ESCALATE** — zatrzymaj się i zapytaj. Lista wyzwalaczy jest zamknięta i znajduje się w `ESCALATION_TRIGGERS`. Skrótowo: zmiana kontraktu, granica MDR, klasyfikacja danych jako medyczne, podstawa prawna i zgody, nowy dostawca zewnętrzny, rozluźnienie reguły bramki, operacja nieodwracalna, wdrożenie, sprzeczność w dokumentach źródłowych.

**Zanim zapytasz, sprawdź `DEFAULTS`.** Czternaście powtarzalnych rozwidleń ma już rozstrzygnięcie z uzasadnieniem: obsługa błędu, stan pusty, format daty, strefa czasowa, paginacja, typ identyfikatora, strategia migracji i inne. To jest właściwe miejsce na „opcję rekomendowaną" — rekomendacja jest zapisana z góry, a nie wymyślana w locie.

**Trzy nieudane próby tego samego podejścia oznaczają eskalację.** Czwarta próba to kręcenie się w kółko, które spala czas i kontekst.

**Pytania zbierasz na koniec, nie zadajesz w trakcie.** Jeśli w trakcie sesji napotkasz coś klasy ESCALATE w obszarze, który nie blokuje dalszej pracy — odłóż to, pracuj dalej nad resztą i zbierz wszystkie pytania w sekcji „Wymaga decyzji" raportu końcowego. Każde pytanie z rekomendacją i uzasadnieniem, żeby odpowiedź była jednym słowem.

**Raport końcowy** ma pięć sekcji z `SESSION_REPORT_SECTIONS`: co ukończone, decyzje podjęte samodzielnie, co zablokowane, pytania wymagające decyzji, stan bramki z jawnym wskazaniem etapów pominiętych.

## System projektowy (ADR-011)

Tokeny są generowane z kontraktu do `packages/contracts/src/generated/tokens.css`. Nie wpisujesz wartości kolorów, rozmiarów ani odstępów — używasz zmiennych CSS.

Styl: czysty i minimalistyczny, oparty na typografii i przestrzeni. Jedna rodzina krojów, jeden kolor akcentu, reszta to skala szarości. Bez gradientów, bez cieni na kartach, bez ikon dekoracyjnych. Przed sięgnięciem po ramkę zwiększ odstęp.

**Odbiorcą jest często osoba starsza albo zaniepokojona.** Dlatego bazowy tekst ma 17px, minimalny kontrast to 4.5:1 także dla tekstu drugorzędnego, a cel dotykowy 48px. Minimalizm nie może kosztować czytelności.

**Kolor nie niesie oceny.** Nigdzie nie ma czerwieni oznaczającej „źle" ani zieleni oznaczającej „dobrze" w kontekście pensjonariusza. Zieleń jest kolorem marki. Czerwień wyłącznie dla błędów technicznych w panelu personelu.

**Metryki prezentujesz jako fakty, bez wykresów sugerujących trend.** Wykres kroków tydzień po tygodniu to zestawienie w celu oceny kondycji — czyli dokładnie to, czego zakazuje ADR-005.

## Czego nie robisz sam

Commit, PR, merge, wdrożenie, otwarcie okna kontraktowego i publikacja raportu do bliskich należą do człowieka. Przygotuj zmianę i opisz ją.

## Przy sprzeczności — zatrzymaj się

Jeżeli dokumenty źródłowe mówią różne rzeczy, nie wybieraj samodzielnie. Wypisz sprzeczność z cytatem i numerem sekcji, oznacz `WYMAGA DECYZJI` i zakończ turę. Zgadywanie przy danych artykułu 9 kosztuje więcej niż tydzień przepisywania.
