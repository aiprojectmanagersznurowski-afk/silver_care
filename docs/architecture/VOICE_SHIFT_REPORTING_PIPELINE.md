# Potok głosowy i zamknięcie zmiany

Dokument porządkuje decyzje po wdrożeniu wejść głosowych na `codex/nowe-zmiany`. Stan integracji odnosi się do [commita `40627359`](https://github.com/aiprojectmanagersznurowski-afk/silver_care/commit/40627359fbe6103c7d217020474863e081f073cb). Docelowy zakres zamknięcia zmiany opisuje [SC-NUR-20](../KANONICZNA_SPECYFIKACJA_USER_STORIES.md). Decyzje zmieniające zachowanie produktu, role lub dane przechodzą przez okno kontraktowe i odpowiedni ADR przed implementacją. Podstawą pozostają [ADR-006, ADR-007, ADR-021, ADR-022 i ADR-023](../01-ADR-decisions.md) oraz `contracts/`.

## 1. Stan integracji

| Obszar | Stan na gałęzi integracyjnej |
|---|---|
| Definicje zmian, grafik i kierownik | `shift_definitions`, `shift_roster`, `is_shift_lead` |
| Lista zadań, ręczne rozliczenie, akceptacja i wydruk | `shift_tasks`, `settle_shift_task`, `shift_plan_approvals`, `record_shift_plan_print`. Jest grupowanie według pokoju lub podopiecznego. Wydruk wymaga dopięcia przypisania i zgodności z wersją widoczną w podglądzie. |
| Nagranie o podopiecznym (`APP`) | `/voice`, istniejący szkic z wybranym `resident_id`. Przetworzone notatki mogą zasilać raporty operacyjne przez redakcję. |
| Nagranie ogólne (`APP_GENERAL`) i plik z dyktafonu (`DEVICE`) | Prywatny Storage, `voice_captures`, `voice_segments`, przypisanie serwerowe i kolejka wyjątków w `/voice/assignment`. |
| Raporty operacyjne i rodzinne | Kategorie per placówka i zredagowane zdarzenia operacyjne. Zweryfikowane fakty rodzinne zasilają szkic podopiecznego za dobę kalendarzową. Publikacja ma własną akcję. |
| Propozycje z nagrania | Jawna dyspozycja na kolejną zmianę daje `PROPOSED` w `shift_tasks`, z cytatem i identyfikatorem źródła. |
| Następny etap | Widok i wydruk według pracownika, głosowa podpowiedź rozliczenia, zamknięcie, odbiór przekazania, aneks oraz osobny obieg incydentu. |

Gałąź integracyjna to `codex/nowe-zmiany`. Promocja do `staging` przebiega osobno po powrocie Michała i review. [PR #313](https://github.com/aiprojectmanagersznurowski-afk/silver_care/pull/313)

## 2. Rozstrzygnięcia dotyczące nagrań

### Kanały, zakres i model danych

Placówka używa webu, urządzeń lub obu kanałów w zależności od organizacji pracy. Trybu używanego na pilotażu pilnuje procedura placówki. Osobną konfigurację wyłączania konkretnego kanału rozważymy po wykazaniu potrzeby.

| Źródło | Zakres początkowy | Autor | Powiązanie ze źródłem |
|---|---|---|---|
| `APP` | Podopieczny wybrany przed nagraniem | Sesja webowa | `voice_draft_notes` |
| `APP_GENERAL` | Zakres nieustalony | Sesja webowa | `voice_captures` → `voice_segments` |
| `DEVICE` | Zakres nieustalony | Deklaracja w pierwszym nagraniu sesji lub ręczna korekta | `voice_captures` → `voice_segments` |

`voice_draft_notes` zachowuje wymagane `resident_id` i `nurse_id` dla trybu `APP`. Nowe źródła mają oddzielny model przyjęcia i podziału, a fakty zachowują relację z segmentem albo istniejącym szkicem. Opis `COMMIT` w `DEVICE_INGEST_PROTOCOL` nadal wskazuje `voice_draft_notes`. Decyzja dla integracji sprzętowej to aktualizacja tego zapisu w oknie kontraktowym, tak aby kierował do `voice_captures` i kolejkowania segmentów po transkrypcji. [#307](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/307)

### Przypisanie i materiał mieszany

Serwer dopasowuje nazwisko, pokój lub łóżko do rejestru właściwej placówki. Jedno spójne dopasowanie wystarcza do przypisania **szkicu**. Sprzeczne wskazania, niepewny czas, nieustalony autor, kilka osób w jednym fragmencie albo brak dopasowania trafiają do kolejki uprawnionego kierownika. Wyraźna sprawa placówki otrzymuje zakres `FACILITY`. W webie autor może z góry wybrać `APP`, a w trybie ogólnym obowiązuje wspólna ścieżka automatycznego przypisania i wyjątków.

Personelowi zalecamy jedną osobę lub sprawę na wypowiedź. Plik może zawierać wiele wypowiedzi, a fragment ma najwyżej jednego podopiecznego. Mieszany fragment wymaga wyodrębnienia dokładnych pododcinków źródłowych przez uprawnioną osobę albo ponownego nagrania. Jeśli żadna ścieżka nie daje jednoznacznego wyniku, kierownik oznacza fragment jako nie do przypisania. Ręczny podział jest rozszerzeniem kolejki. Dziś kierownik ma do dyspozycji jej dotychczasowe decyzje.

```mermaid
flowchart TD
    app["Web z wybranym podopiecznym"] --> draft["Istniejący szkic"]
    general["Nagranie ogólne z webu"] --> capture["Prywatny zapis nagrania"]
    device["Plik dyktafonu w Storage"] --> capture
    capture --> segment["Kontrolowana transkrypcja i fragmenty"]
    segment --> match{"Serwer ustala zakres, autora i czas"}
    match -->|"Spójne dopasowanie lub jawna sprawa placówki"| redact["Redakcja danych i przygotowanie faktów"]
    match -->|"Wyjątek"| review["Kolejka kierownika"]
    review -->|"Rozstrzygnięty fragment"| redact
    draft --> redact
    redact --> output["Szkice raportów i propozycje zadań"]
```

### Wspólny dyktafon, czas i audyt

Pracownik przedstawia się na początku sesji urządzenia. Jedno dopasowanie do personelu placówki zapisuje deklarowanego autora. Przydział sprzętu służy ewidencji wydania. Niepewna deklaracja trafia do kolejki. Ręczna korekta dotyczy wskazanego fragmentu i ma własny ślad. Przy przejęciu dyktafonu bez nowej sesji i przedstawienia się audyt zachowuje deklarację bieżącej sesji. Źródło bez ustalonego autora pozostaje w stanie `UNKNOWN`. Wartość „zespół” służy przypisaniu zadania wspólnego. Do autorstwa używamy rozpoznanej osoby lub jawnego braku.

- `recorded_at`, `received_at` i czas opisywanego zdarzenia mają różne znaczenie. Czas zdarzenia wskazany przez personel zapisujemy odrębnie i może pozostać nieustalony.
- Zmiana wynika z wiarygodnego czasu nagrania w `Europe/Warsaw` z uwzględnieniem zmiany nocnej. `SYNCED` korzysta z czasu urządzenia, a `RELATIVE` z chwili przyjęcia INIT pomniejszonej o wiek nagrania. Dla `UNKNOWN` docelowo kierownik wskazuje zmianę i podstawę korekty, zachowując oryginalny czas w metadanych.
- Audyt zapisuje identyfikatory źródła i aktora, metodę, czas oraz zmianę przypisania. Treść audio, transkrypt i dane medyczne pozostają w przeznaczonych do tego zasobach z odrębnymi uprawnieniami i retencją.
- Odkładanie urządzeń 20 minut przed końcem zmiany i rozliczenie w ciągu 30 minut po końcu to punkt wyjścia pilotażu. Interfejs pokazuje postęp synchronizacji oraz możliwość zamknięcia częściowego. Placówka ustala organizację pracy.

## 3. Zamknięcie zmiany, zadania i wydruk

Widok „Zamknięcie zmiany” prowadzi kierownika zamykanej zmiany lub kierownika placówki od wyjątków przypisań przez fakty i rozliczenia do szkicu przekazania. Nagłówek podaje zmianę, datę, odpowiedzialną osobę, kompletność materiału i wersję przekazania. Szczegóły wiążą decyzję z identyfikatorem źródła. Odczyt źródła podlega jego własnym uprawnieniom.

1. **Zadania.** Korzystamy z `shift_tasks` i `assignee_user_id`. Pracownik pochodzi z grafiku danej placówki i zmiany. Puste przypisanie oznacza zadanie wspólne. Obok pokoju i podopiecznego dochodzi widok według pracownika. Zespół widzi tę samą listę na uwierzytelnionym urządzeniu placówki w dyżurce. Wydruk A4 pozostaje kanałem dla zespołów pracujących z papierem.
2. **Propozycje i rozliczenie.** Nowe zadanie z wypowiedzi ma status `PROPOSED`. Głosowe sprawozdanie o wykonaniu daje podpowiedź do istniejącego zadania z jednoznacznym dopasowaniem i cytatem. Negację, odmowę, warunek i brak pewności obsługujemy odrębnie. Uprawniony kierownik podejmuje decyzję przez istniejący mechanizm rozliczenia. Zgłoszenie usterki jest faktem operacyjnym. Wyraźna dyspozycja działania może dodatkowo dać propozycję zadania placówki.
3. **Przekazanie.** Szkic korzysta z dopuszczonych faktów tej zmiany, stanu zadań, otwartych spraw i opcjonalnej notatki kierownika. Notatka oznaczona jako przekazanie zasila obieg wewnętrzny. Kierownik zatwierdza treść, a kierownik przyjmującej zmiany lub uprawniony zastępca potwierdza odbiór konkretnej wersji z osobnym czasem i aktorem.
4. **Plan i wydruk.** Kierownik zatwierdza wersję planu następnej zmiany. Wydruk pokazuje tę samą wersję co zdarzenie audytowe. Powtórzenie niezmienionego wydruku zapisuje kolejny ślad dla tej samej wersji. Zmiana planu, także przypisania, wymaga następnej akceptacji. Wydruk pokazuje faktyczne przypisanie i zawiera pola dopuszczone przez kontrakt.
5. **Braki i spóźnione dane.** `COMPLETE` wymaga dowodu, że oczekiwane nagrania z danego zakresu dotarły. Sam upływ czasu nie stanowi dowodu. `PARTIAL` oznacza znany brak, a `UNKNOWN` brak dowodu kompletności. W dwóch ostatnich stanach kierownik może zatwierdzić przekazanie jako częściowe z jawnym powodem. Spóźniony materiał tworzy propozycję aneksu powiązaną z wcześniejszą wersją. Zatwierdzony aneks ma własny audyt i własny odbiór.

## 4. Raporty i formalny incydent

| Wynik | Źródło i obieg |
|---|---|
| Przekazanie wewnętrzne | Dopuszczone fakty zakończonej zmiany, rozliczenie zadań i otwarte sprawy. Osobna akceptacja, odbiór i aneks. Potrzebne dane medyczne pozostają w ograniczonej części z `daily_logs`, bez przekazywania ich do modelu. |
| Raport operacyjny | Zredagowane zdarzenia kategorii w jej oknie. Odbiorcy wynikają z konfiguracji placówki. Brak danych ma jawny komunikat. |
| Formalny incydent | Oddzielna wewnętrzna sprawa z powiązaniem źródła, osobą odpowiedzialną, działaniami, statusem i decyzją kierownika placówki lub wyznaczonej roli. Nagranie może podpowiedzieć szkic zgłoszenia. Pilne działania biegną dotychczasową procedurą placówki. Pierwsze wydanie obejmuje obsługę i historię w systemie. Eksport jest odrębnym etapem po uzgodnieniu formatu i uprawnień. |
| Raport rodzinny | Tylko dopuszczone fakty dotyczące jednego podopiecznego. Osobne zatwierdzenie i publikacja przez uprawnioną osobę. Po publikacji spóźnione fakty mogą wejść do jawnej korekty zatwierdzanej przez człowieka. |

Szczegóły leków i inne informacje zdrowotne zachowują kontrolę dostępu z `daily_logs`. Potwierdzenie zgłoszenia dotyczącego leków należy do osoby z uprawnieniami określonymi przez procedurę placówki i obowiązujący kontrakt. Sposób postępowania z danymi medycznymi, zakres odpowiedzialności oraz podstawa prawna podlegają zatwierdzeniu przed pilotażem. [#306](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/306)

### Doba rodzinna i obchód

Obecna doba szkicu biegnie od północy do północy w `Europe/Warsaw`. Docelowo placówka może oznaczyć jedną zmianę jako zamykającą dobę raportu. Przy dwóch i trzech zmianach okno wyznaczają kolejne lokalne końce tej zmiany. Dla grafiku 07:00–19:00 i 19:00–07:00 po wskazaniu zmiany dziennej doba kończy się o 19:00. Placówki bez takiej konfiguracji zachowują północ. Nowa granica działa dla przyszłych okresów, uwzględnia zmianę czasu i zachowuje historię szkiców. Przejście wymaga osobnego kontraktu i testów. Kierownik zmiany zamykającej dobę albo osoba uprawniona do zastępstwa publikuje raport po osobnym zatwierdzeniu. Szkic zapisuje się względem konkretnej wersji, a konflikt wymaga ponownego odczytu. Opublikowaną treść uzupełnia się przez jawną korektę.

Osoba, która wykonała obchód, rejestruje jego wykonanie. Kierownik zmiany weryfikuje zapis przed publikacją. Komunikat o obchodzie może powstać po potwierdzeniu wykonania. Przy braku dowodu szkic albo widok personelu mówi wprost o braku danych. Powiadomienie dla bliskich wynika z publikacji zatwierdzonego raportu.

## 5. Instrukcja wdrożenia i weryfikacji

- **Planista.** Wybieramy jeden planista HTTPS na środowisko, który trzyma `CRON_SECRET` w swoim magazynie sekretów i wywołuje chronionego workera. W pilotażu zacznij od wywołania co minutę. Dopasuj częstotliwość do czasu obsługi i wieku najstarszego oczekującego nagrania. Sprawdź ponowienia, idempotencję i retencję na docelowym środowisku. Przypomnienia organizacyjne w pierwszym etapie trafiają do widoku personelu.
- **Prywatność.** Audio i transkrypt pozostają w prywatnym Storage i zatwierdzonej usłudze transkrypcji oraz redakcji. Model raportowy w EOG otrzymuje materiał po redakcji. Tryb demo dotyczy danych syntetycznych w granicach kontraktu. Retencję odczytujemy z `VOICE_RETENTION` i ustawień placówki. Cykl życia kont personelu zachowuje powiązania audytowe zgodnie z kontraktem. Zakończenie pracy w placówce wygasza dostęp. Formalizacja pilotażu, zatwierdzenie warunków przetwarzania i procedura placówki poprzedzają użycie rzeczywistych danych. [#306](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/306)
- **Urządzenia.** Dyktafon zachowuje plik do potwierdzenia trwałego przyjęcia. Przy braku Wi-Fi wykorzystywana jest kontrolowana kolejka urządzenia. Pilotaż zaczyna się bez dodatkowego lokalnego bufora. Instrukcja personelu obejmuje nagrywanie w otoczeniu innych osób i zasady używania sprzętu placówki. [#307](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/307), [#309](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/309)
- **Test odbiorowy.** Na danych syntetycznych przejdź oba wejścia webowe, zrzut z urządzenia, powtórzenie wysyłki, brak autora, niepewny czas, kilka osób w fragmencie, zamknięcie częściowe i aneks. Sprawdź RLS między placówkami, dostęp rodziny, wydruk dokładnie zatwierdzonej wersji i ślad w audycie bez treści notatek.
- **Pomiar pilotażu.** Przed startem zbierz próbę porównywalnych zmian dziennych i nocnych. Mierz medianę i 90. percentyl czasu pracy kierownika od rozpoczęcia rozliczenia do zatwierdzenia, czas personelu poświęcony na dokumentację, czas do odbioru przekazania, odsetek fragmentów przypisanych bez korekty i odsetek zmian częściowych. Rozdziel opóźnienie synchronizacji od pracy człowieka. Agreguj wyniki bez treści nagrań i danych podopiecznych. [#309](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/309)

## 6. Uruchomienie lokalne i wejście ze stacji

1. Użyj commita `40627359` lub nowszego na `origin/codex/nowe-zmiany`. Przy checkoutcie z lokalnymi zmianami test można prowadzić w osobnym worktree. Skieruj aplikację na lokalny Supabase z migracjami tej gałęzi.
2. Przekaż serwerowi web lokalny adres i klucze Supabase według [`.env.example`](../../.env.example). Zaloguj się kontem personelu z włączonym modułem nagrań. Do wysłania nagrania ogólnego potrzebna jest sesja z drugim składnikiem uwierzytelniania.
3. W `/voice` sprawdź oba tryby. Nagranie z wybranym podopiecznym prowadzi do istniejącego szkicu. „Nagranie ogólne” zapisuje plik do przetworzenia. Komunikat o przyjęciu potwierdza etap zapisu.
4. Aby sprawdzić wynik z nagrania ogólnego, skonfiguruj prywatne usługi oraz uruchom workera. Użyj syntetycznego tekstu z jednoznacznym przypisaniem i drugiej próbki bez niego. Sprawdź `/voice/assignment`, `/staff/reports/voice-facts`, `/staff/reports/operational` i propozycje zadań na liście odpowiedniej zmiany.

| Zmienna | Zachowanie |
|---|---|
| `VOICE_PRIVATE_STT_URL` | HTTPS. POST zawiera bajty audio i typ pliku. JSON zwraca uporządkowane `segments` z polami `start_ms`, `end_ms`, `text`. |
| `VOICE_PRIVATE_REDACT_URL` | HTTPS w tym samym originie co STT. POST zawiera pole `text`. JSON zwraca `redacted_transcript` po usunięciu danych identyfikujących i medycznych. Pusty ciąg oznacza brak fragmentu do klasyfikacji. |
| `VOICE_PRIVATE_STT_TOKEN` | Serwerowy token Bearer do obu prywatnych usług. |
| `EU_LLM_API_KEY`, `EU_LLM_ENDPOINT`, `EU_LLM_MODEL` | Konfiguracja dozwolonego modelu w EOG dla zredagowanych danych raportowych. |
| `CRON_SECRET` | Token Bearer do `GET /api/cron/process-voice-captures`. W lokalnej próbie można wywołać ścieżkę ręcznie kilka razy. Transkrypcja, projekcja i generowanie to odrębne zadania workera. |

Wywołanie lokalnego serwera na porcie 3001 używa wartości `CRON_SECRET` z lokalnego środowiska.

```bash
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3001/api/cron/process-voice-captures
```

Usługa stacji zapisuje plik w prywatnym buckecie `voice-recordings` pod kluczem `<organization_id>/device/<device_id>/<client_capture_id>`. Po trwałym zapisie wywołuje `register_stored_device_capture` kontem usługi z identyfikatorami urządzenia, sesji i nagrania, kolejnością w sesji, kluczem Storage, SHA-256, czasem nagrania i stanem zegara. Ponowienie z identycznymi metadanymi zwraca dotychczasowe ID. Rejestracja sprawdza obecność pliku, a worker sprawdza jego SHA-256. Docelowy protokół opiera INIT, UPLOAD i COMMIT na podpisanym zapisie w Storage. Końcowy ACK, po którym urządzenie może skasować swoją kopię, potwierdza trwały zapis i zgodność sumy kontrolnej. Firmware i stacja są prowadzone jako osobny strumień. [#307](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/307)

## 7. Kolejność GitHub Issues

Stan z 22 listopada 2026. Numery wskazują istniejące otwarte issues. Pozycje „nowe issue” są propozycjami do zapisania na GitHubie przed rozpoczęciem danej implementacji.

| Kolejność | Issue i zależności | Oczekiwany rezultat |
|---|---|---|
| 0 · równolegle | [#316](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/316), [#304](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/304), [#314](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/314), [#315](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/315) | Zestaw dowody z `codex/nowe-zmiany` z kryteriami otwartych issues. Wykonaj lokalną próbę obu wejść webowych i zapisz braki jako zadania do uzupełnienia. |
| 1 · kontrakt | Nowe issue „Kontrakt zamknięcia zmiany” | Powiąż `SC-NUR-20` z `NUR-SHIFT-CLOSURE`. Po otwarciu okna przez człowieka ustal role, kompletność, stany, wersję, odbiór i aneks. Uzupełnij `SHIFT_TASK_POLICY` o widok pracownika i warunki przypisania. Rozpisz część incydentów jako odrębny zakres. |
| 2 · plan pracy | [#259](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/259) i [#305](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/305) po odpowiednim fragmencie kontraktu | Przypisanie z grafiku, wspólne zadania, widok według pracownika, minimalny wydruk i zgodność wersji z audytem. Zabezpieczenie wersji wydruku można zacząć na podstawie obecnego `NUR-SHIFT-PLAN-PRINT`. |
| 3a · rozliczenie głosowe | Nowe issue „Głosowe podpowiedzi rozliczenia” po kroku 1, powiązane z [#259](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/259) | Dopasuj wypowiedź do istniejącego zadania, rozróżnij negację i odmowę, przetestuj decyzję przez `settle_shift_task`. |
| 3b · wyjątki źródłowe | Nowe issue „Korekta czasu i podział mieszanego fragmentu”, powiązane z [#316](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/316) | Rozstrzygnij czas i mieszany materiał w kolejce. Zachowaj oryginalne metadane, precyzyjne granice pododcinków oraz historię korekty. |
| 4 · przekazanie | Nowe issue „Zamknięcie zmiany, odbiór i aneks” po kroku 1, z integracją kroków 2 i 3 | Wersjonowane zatwierdzenie, jawny stan niekompletny, odbiór i aneks. Jeden widok i test przebiegu dwóch zmian. |
| 5 · raporty szczególne | Dwa nowe issues „Wewnętrzny obieg incydentów” i „Granica doby i korekty raportu rodzinnego” | Osobny obieg incydentu oraz jawne zasady doby, spóźnionych faktów, uprawnień i publikacji raportu rodzinnego. Prace mogą biec równolegle z domykaniem widoku po uzgodnieniu odpowiednich kontraktów. |
| 6 · pilotaż i promocja | [#306](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/306), [#309](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/309), sprzętowo [#307](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/307) | Formalizacja pilotażu, prywatne STT i redakcja, harmonogram, dowód retencji i gotowość placówki. Akceptacja przez drugą osobę przed promocją. |

Historia raportów, odczyty audytowe i analityka realizacji mają własne zakresy. Zamknięcie zmiany korzysta z istniejącego `audit_logs` dla decyzji i z `shift_tasks` jako trwałej listy. [#258](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/258), [#310](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/310), [#311](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/311)

Każde issue wskazuje kanoniczne story, REQ, zależności i dowody akceptacji. Prace przechodzą przez PLAN → CONTRACT, gdy potrzeba → RED → GREEN → VERIFY → REVIEW. Komentarze, przypisania i statusy review prowadź w GitHub Issues oraz GitHub Projects „Silver Care”. Do przekazania kompletnego zakresu służy `node tools/sc-pr-handoff.mjs <NUMER_ISSUE> --pr <NUMER_PR>`. W trakcie integracji używaj `Refs #…`, a `Closes #…` wiąż z PR-em, który dostarcza całe issue.
