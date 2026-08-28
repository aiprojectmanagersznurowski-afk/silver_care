# Rejestr decyzji architektonicznych — Silver Care

Osiem sprzeczności znalezionych w dokumentach źródłowych, rozstrzygniętych przez Michała 2026-08-27. Każda zamknięta zmianą w kontrakcie i regułą bramki z dowodem żywotności.

**Status: 13 z 13 rozstrzygniętych.** Kontrakt nie ma elementów w statusie propozycji. Walidator zgłasza jedno ostrzeżenie — celowe, patrz ADR-013 — i 24 reguły bramki blokują swoje mutacje.

---

## ADR-001 — Czy ingest Polara jest w MVP ✅

**Sprzeczność.** MVP stawiał dane z opaski jako „źródło prawdy" i punkt pierwszy zakresu. Schemat produkcyjny (`dbschema.txt`, 21 tabel) nie zawierał ani jednej tabeli Polar, a `consent_ledger` miał notatkę „purpose wearable_family_access = hak Fazy 3. MVP: brak ingestu". User stories opisywały kartę komfortu jako pusty stan z komunikatem „funkcja w przygotowaniu".

**Decyzja: ingest jest w MVP.**

**Wykonane.** Dostawca `POLAR` ma status `ACTIVE` w `integration.contract.mjs`, pełne mapowania pól i cztery warunki wstępne zapisu. Kontrakt prezentacji rozstrzyga osobno, co z tych danych widzą bliscy — patrz ADR-005.

---

## ADR-002 — `care_homes` kontra `organizations`, warstwa integracyjna ✅

**Sprzeczność.** Dwa schematy nazywały ten sam byt inaczej: `care_homes` i `patients` w dokumencie Polar, `organizations` i `patients` w schemacie produkcyjnym. Identyfikator `polar_user_id` siedział bezpośrednio na rekordzie pensjonariusza.

**Decyzja.** Rdzeń nazywa się `organizations` i `residents`. Identyfikatory zewnętrzne nie mieszkają na tabelach rdzenia — trafiają do warstwy pośredniej, bo dostawców i systemów źródłowych będzie więcej.

**Wykonane.** Tabele mapujące `external_wearable_links` (klucz rdzenia `resident_id`, klucze zewnętrzne `provider` + `external_user_id` + `external_device_id`) oraz `external_org_links`. Reguła `R06-core-decoupled` blokuje powrót identyfikatora dostawcy do rdzenia. Narzędzie `sc-naming.mjs` skanuje repozytorium pod kątem porzuconych nazw i przepuszcza je wyłącznie w warstwie integracyjnej.

**Dlaczego to ważne.** Gdyby `polar_user_id` został na `residents`, dodanie drugiego producenta oznaczałoby migrację tabeli rdzenia w systemie z danymi artykułu 9 — czyli operację, której najbardziej chce się uniknąć.

---

## ADR-003 — Opiekun prawny to inna rola niż rodzina ✅

**Sprzeczność.** User stories traktowały `legal_guardian` jako jedną z wartości pola `relationship`, obok „córka" i „syn". To zrównywało pokrewieństwo z umocowaniem prawnym. MVP wskazywał to jako ryzyko krytyczne: część pensjonariuszy jest ubezwłasnowolniona, a rodzina nie jest automatycznie uprawniona do zgody na przetwarzanie danych o zdrowiu.

**Decyzja: to dwie różne role o różnych uprawnieniach.**

**Wykonane.** `legal_guardian` i `family` to osobne role w `ROLES`. Lista `CONSENT_GRANTORS` zawiera wyłącznie `resident_self` i `legal_guardian`. Macierz uprawnień nie daje roli `family` zapisu do rejestru zgód.

**Reguły bramki.** `R02-consent-grantor` blokuje dopisanie roli `family` do listy uprawnionych oraz przyznanie jej zapisu w rejestrze. `R03-consent-immutable` blokuje przyznanie komukolwiek `update` lub `delete` na rejestrze zgód — cofnięcie zgody to zapis `revoked_at`, nie edycja historii.

---

## ADR-004 — Zakazane słownictwo ✅

**Sprzeczność.** Kryterium `SC-ADM-03/AC1` zakazywało słowa „pacjent" w interfejsie ze względu na MDR, a schemat nazywał tabelę `patients` i klucz `patient_id`.

**Decyzja.** Identyfikatory techniczne w bazie mogą pozostać angielskie. Zakaz obowiązuje w warstwie widocznej dla użytkownika. Rdzeń i tak przechodzi na `residents` z ADR-002.

**Wykonane.** Lista `FORBIDDEN_UI_TERMS` z zamiennikami i uzasadnieniem. Reguła hooka `adr004-patient-term` blokuje zapis pliku warstwy prezentacji zawierającego to słowo.

**Znalezione przy testowaniu reguły.** Pierwsza wersja wzorca łapała tylko „pacjent" i przepuszczała formę „o pacjencie" — polski miejscownik zmienia temat z `t` na `c`. Wzorzec obejmuje teraz obie formy. Ta luka przeszłaby do produkcji jako działająca reguła.

---

## ADR-005 — Granica MDR: co widzą bliscy (wariant B) ✅

**Sprzeczność.** MVP zakazywał interpretacji medycznej, ale nie rozstrzygał, czy surowe parametry z opaski mogą trafić do portalu. Wytyczne przekazane przez Michała mówią, że parametry życiowe są danymi medycznymi, „jeśli są zestawiane w celu oceny kondycji organizmu".

**Decyzja: wariant B.** Bliscy widzą metryki behawioralne — kroki, czas aktywności, długość i godziny snu. Nie widzą tętna, HRV, tętna spoczynkowego ani wyniku snu. Dane fizjologiczne są zbierane i dostępne personelowi; zakaz dotyczy prezentacji, nie przechowywania.

**Uzasadnienie.** Zgoda z RODO nie zmienia klasyfikacji MDR — to dwa niezależne reżimy. O klasyfikacji decyduje przewidziane zastosowanie. Wykres tętna dzień po dniu istnieje po to, żeby ktoś ocenił, czy z bliskim jest lepiej czy gorzej, i to jest funkcja monitorowania stanu.

**Wykonane.** `FAMILY_VISIBLE_METRICS` jako lista zamknięta (allowlist, nie denylist), `PHYSIOLOGICAL_FIELDS` z dwunastoma polami ukrytymi przed bliskimi, `MDR_GUARDRAILS` z listami dozwolonych i zakazanych sformułowań, przewidzianym zastosowaniem i jedynym dozwolonym wyzwalaczem powiadomień.

**Reguły bramki.** `R04-mdr-family-metrics` blokuje dodanie metryki fizjologicznej do listy widocznej bliskim. `R05-mapping-visibility` pilnuje zgodności między mapowaniem integracji a granicą prezentacji. `R10-no-metric-alarm` blokuje powiadomienie wyzwalane metryką. Hook `adr005-physio-leak` blokuje użycie pola fizjologicznego w plikach warstwy rodziny, `adr005-clinical-language` blokuje język kliniczny w treściach.

**Funkcja czasu wykonania.** Wygenerowany `assertFamilyVisible()` rzuca wyjątkiem, jeśli pole fizjologiczne trafi do warstwy bliskich mimo przejścia bramek statycznych.

---

## ADR-006 — Zero zgadywania tożsamości ✅

**Decyzja.** Model nigdy nie ustala, kogo dotyczy notatka. Frontend przekazuje `resident_id` jako UUID, transkrypt idzie do modelu anonimowy, złączenie następuje w pamięci funkcji brzegowej przed zapisem. Brak identyfikatora kończy się odmową, nie próbą rozpoznania.

**Wykonane.** Siedmioetapowy potok w `voice.contract.mjs` z jawnym wejściem i wyjściem każdego etapu. Reguła `R08-zero-guessing` sprawdza, że etap przechwycenia przyjmuje identyfikator, etap generowania deklaruje anonimowe wejście, a złączenie następuje po generowaniu. Hook `adr006-identity-guess` blokuje kod próbujący rozpoznać tożsamość z transkryptu.

---

## ADR-007 — Dane medyczne usuwane przed modelem ✅

**Zaostrzenie wobec dokumentów.** User stories mówiły, że lek „ląduje w brudnopisie", ale nie precyzowały, że model generujący raport ma go nie widzieć. Wytyczne Michała to zaostrzają: separacja następuje przed wejściem do modelu, nie po.

**Decyzja.** Transkrypt dzieli się na trzy strumienie. `MEDICAL` nie dociera do modelu i nie dociera do bliskich. `DISCOMFORT` dociera do modelu, ale do raportu trafia ogólny opis. `BEHAVIORAL` jest podstawą raportu.

**Wykonane.** Kolejność etapów wymusza redakcję przed generowaniem. Pięć kategorii medycznych z definicji artykułu 4 punkt 15 RODO: leki, diagnozy, wyniki badań, parametry życiowe, zalecenia kliniczne.

**Reguły bramki.** `R07-redact-before-llm` sprawdza kolejność etapów, oznaczenie strumienia medycznego jako niedocierającego do modelu i brak ról bliskich wśród jego odbiorców. `R13-draft-isolation` blokuje przyznanie bliskim odczytu brudnopisu. Hook `adr007-raw-transcript-to-llm` blokuje wysłanie surowego transkryptu do modelu.

---

## ADR-008 — Brak danych osobowych w logach ✅

**Decyzja.** Komponenty backendowe nie przesyłają danych osobowych ani telemetrycznych do konsoli i do zewnętrznego monitoringu. Obsługa błędów operuje na UUID i kodach technicznych.

**Wykonane.** Hook `adr008-pii-logging` blokuje logowanie zmiennych o nazwach wskazujących na dane osobowe. Hook `adr008-pesel-plaintext` wymusza wyłącznie `pesel_hash`. Powiadomienia mają jawne pole `containsPersonalData`, a reguła `R10` blokuje ustawienie go na prawdę.

**Znalezione przy testowaniu reguły.** Pierwsza wersja wzorca blokowała także `console.log(residentId)` — czyli dokładnie to, co `NFR-SEC-01/AC2` wprost zaleca. Wzorzec przepuszcza teraz identyfikatory, blokując nośniki treści.

---

## ADR-009 — Dostawca transkrypcji: Groq, wyjątek od reguły EOG ✅

**Kontekst.** Potok głosowy z ADR-006/ADR-007 potrzebuje dostawcy transkrypcji audio. Padła propozycja Groq (nie mylić z Grok/xAI — dwie różne firmy, Grok nie ma umowy powierzenia i jest pod dochodzeniem trzech europejskich regulatorów, więc odpadł bez dalszej analizy).

**Napięcie.** `INFRA-EU-REGION` wymaga, żeby dane nie opuszczały EOG. Groq ma umowę powierzenia i opcję zerowej retencji, ale podstawowa infrastruktura jest w USA — transfer odbywa się na bazie standardowych klauzul umownych, nie fizycznej rezydencji w Europie.

**Decyzja (Michał, 2026-08-27): Groq jako wyjątek udokumentowany, nie cichy kompromis.** Uzasadnienie ekonomiczne: darmowy poziom (2000 żądań dziennie, osiem godzin audio dziennie) pokrywa całą skalę MVP dla piętnastu do dwudziestu pięciu pensjonariuszy bez żadnego kosztu.

**Wykonane.** `GROQ` dodany do `PROVIDERS` w `integration.contract.mjs` z czterema polami, których nie mają pozostali dostawcy: `transferMechanism`, `exceptionApprovedBy`, `exceptionReason`, `requiresManualZeroRetentionToggle`. Nowe wymaganie `INFRA-GROQ-TRANSCRIPTION`. `INFRA-EU-REGION` uzupełnione o jawne dopuszczenie wyjątku pod warunkiem udokumentowania.

**Wyjątek jest ograniczony do jednego etapu, nie całego potoku.** Groq dotyka wyłącznie `TRANSCRIBE` — zamiany surowego audio na tekst. Klasyfikacja strumieni, redakcja danych medycznych i generowanie raportu dla bliskich (ADR-007) dzieją się już w infrastrukturze europejskiej. Transkrypt trafiający do modelu generującego raport nigdy nie dotyka Groq.

**Nowa reguła `R22-transfer-exception`.** Region różny od EU nie jest sam w sobie błędem — ale bez trzech odnotowanych elementów (mechanizm transferu, kto zatwierdził, uzasadnienie o długości minimum czterdziestu znaków) jest błędem. To rozróżnia świadomy wyjątek od cichego kompromisu: `GARMIN` i `TERRA` mają `region: 'UNKNOWN'` i są zablokowane przez istniejącą regułę `R06`, `GROQ` ma `region: 'US'` i jest dopuszczony wyłącznie dlatego, że niesie ze sobą papiery.

**Operacyjne, nie kodowe.** Zerowa retencja to przełącznik w panelu Groq, którego żaden test jednostkowy nie potwierdzi. `INFRA-GROQ-TRANSCRIPTION` zapisuje to jako kryterium akceptacji wprost, żeby nie zniknęło między kontraktem a wdrożeniem.

**Co pozostaje otwarte.** Limit darmowego poziomu jest hojny, ale nie monitorowany automatycznie — jeśli pilotaż urośnie ponad piętnaście do dwudziestu pięciu osób, ktoś musi zauważyć zbliżający się próg, zanim konto zacznie naliczać opłaty albo odrzucać żądania. To zadanie operacyjne, nie architektoniczne.

---

## ADR-010 — Tryb autonomiczny ✅

**Decyzja (Michał, 2026-08-27).** Agent pracuje samodzielnie i pyta wyłącznie wtedy, gdy decyzja jest naprawdę wymagana. Przy rozwidleniach wybiera opcję rekomendowaną i kontynuuje.

**Napięcie.** Pełna autonomia w systemie z danymi artykułu 9 obeszłaby zabezpieczenia zbudowane w ADR-003, 005 i 007. Agent, który sam rozstrzyga, czy coś jest daną medyczną albo czy pole może trafić do rodziny, nie ma nad sobą żadnej kontroli poza własnym osądem.

**Rozwiązanie: trzy klasy decyzji i zamknięta lista wyjątków.** `AUTO` decyduje i idzie dalej. `AUTO_LOGGED` decyduje, zapisuje decyzję z odrzuconą alternatywą i idzie dalej. `ESCALATE` zatrzymuje pracę — ale lista wyzwalaczy jest zamknięta, krótka i pilnowana regułą bramki.

**Czternaście domyślnych rozstrzygnięć.** To jest właściwe miejsce na „opcję rekomendowaną": rekomendacja jest zapisana z góry, z uzasadnieniem, a nie wymyślana przez agenta w locie. Obsługa błędu domyślnie zamknięta, migracja zawsze przyrostowa, brak danych pomijany zamiast pokazywany jako zero.

**Pytania zbierane na koniec.** Agent nie przerywa pracy przy pierwszym pytaniu — odkłada je, pracuje dalej nad resztą i przedstawia wszystko w jednej sekcji raportu, każde z rekomendacją, żeby odpowiedź była jednym słowem.

**Trzy próby, potem eskalacja.** Czwarte podejście do tego samego problemu oznacza, że problem jest gdzie indziej.

**Reguła `R23-autonomy-limits`.** Chroni wszystkie pozostałe reguły: sprawdza, że klasa `ESCALATE` faktycznie zatrzymuje pracę, że siedem krytycznych wyzwalaczy jest na liście i że każdy ma uzasadnienie. Bez tej reguły agent mógłby sam sobie poszerzyć uprawnienia, usuwając wyzwalacz z listy. Mutacja usuwa wyzwalacz granicy MDR i sprawdza, czy bramka się zapala.

---

## ADR-011 — System projektowy ✅

**Decyzja (Michał, 2026-08-27).** Styl Apple: czysty, minimalistyczny, oparty na typografii i przestrzeni.

**Krój.** `-apple-system, BlinkMacSystemFont, "Inter", system-ui`. Na urządzeniach Apple daje to prawdziwe SF Pro, na pozostałych Inter — zaprojektowany z tymi samymi proporcjami, przy tekście interfejsowym różnica jest niewidoczna. Zestaw `latin-ext` jest wymagany, bo bez niego polskie znaki diakrytyczne byłyby zastępowane.

**Jedna korekta względem oryginału Apple, świadoma.** Odbiorcą jest tu często osoba starsza albo zaniepokojona. Dlatego bazowy tekst ma 17px zamiast 14px, minimalny kontrast wynosi 4.5:1 także dla tekstu drugorzędnego (Apple wygasza go zwykle do 3:1), a cel dotykowy to 48px zamiast 44px. Minimalizm nie może kosztować czytelności.

**Kolor nie niesie oceny.** Paleta to ciepła biel, skala szarości i jeden kolor akcentu — kojąca zieleń z `NFR-UI-01`. Nigdzie nie ma czerwieni oznaczającej „źle" ani zieleni oznaczającej „dobrze" w kontekście pensjonariusza. To wynika wprost z ADR-005: system nie ocenia stanu. Zieleń jest kolorem marki, czerwień wyłącznie dla błędów technicznych w panelu personelu.

**Metryki jako fakty, bez wykresów.** Zasada `quiet-metrics` w `LAYOUT_PRINCIPLES`. Wykres kroków tydzień po tygodniu to zestawienie w celu oceny kondycji — dokładnie to, czego zakazuje ADR-005. Liczba w karcie nie jest.

**Tokeny generowane, nie przepisywane.** `sc-codegen` emituje `tokens.css` ze zmiennymi CSS, obsługą trybu ciemnego i `prefers-reduced-motion`. Agent nie wpisuje wartości kolorów ani rozmiarów.

**Reguła `R24-design-a11y`.** Sprawdza próg czytelności, obecność zestawu `latin-ext`, kontrast, cel dotykowy, komplet tokenów w obu motywach i obecność zasady o cichej prezentacji metryk. Mutacja zmniejsza bazowy tekst do 14px i sprawdza, czy bramka się zapala.

---

## ADR-012 — Rejestr pokoi i łóżek ✅

**Kontekst.** Schemat produkcyjny miał na rekordzie pensjonariusza trzy luźne pola tekstowe: `room`, `sector`, `floor`. Wystarczały do wyświetlenia informacji, ale nie dawały: ochrony przed literówką w numeracji, policzenia wolnych łóżek ani zablokowania przypisania dwóch osób do tego samego łóżka. Żadna user story nie opisywała samego zarządzania pokojami — luka nie wynikała ze świadomej decyzji, tylko z tego, że temat nie został poruszony w dokumentach źródłowych.

**Decyzja (Michał, 2026-08-27), dwie części.** Pokoje są osobnym rejestrem zarządzanym przez administratora, nie polem tekstowym. Podwójne przypisanie jest twardo zablokowane, nie tylko niezalecane.

**Wykonane.** Nowy kontrakt `facility.contract.mjs` z trzema tabelami: `rooms`, `beds`, `bed_assignments`. Piętro i sektor zostają na pokoju, nie na łóżku — łóżka w jednym pokoju są zawsze na tym samym piętrze, duplikowanie tej informacji na każdym łóżku otworzyłoby drzwi do rozjazdu przy edycji. Numeracja łóżek jest lokalna względem pokoju, nie globalna — „łóżko 1" znaczy co innego w każdym pokoju, tak jak w rzeczywistości.

**Historia, nie nadpisanie.** `bed_assignments` to osobna tabela z `assigned_at` i `unassigned_at`, nie kolumna `bed_id` bezpośrednio na `residents`. Trzeba wiedzieć, kto leżał gdzie i kiedy, nie tylko kto leży teraz — bez historii przeniesienie między pokojami kasowałoby ślad potrzebny choćby przy wyjaśnianiu zdarzenia w konkretnym pomieszczeniu.

**Cztery guardy, każdy z jawną reakcją REJECT.** Łóżko z aktywnym przypisaniem nie przyjmuje drugiego. Pensjonariusz z aktywnym przypisaniem nie dostaje drugiego bez zamknięcia pierwszego — przeniesienie jest jedną operacją w jednej transakcji, zamykającą stare i otwierającą nowe, nigdy dwiema osobnymi krokami. Łóżko i pensjonariusz nieaktywny/zarchiwizowany nie przyjmują nowych przypisań.

**Obłożenie jest polem pochodnym, nie osobno utrzymywaną liczbą.** Widok `room_occupancy` liczy wolne łóżka z aktywnych przypisań przy każdym zapytaniu — nie może rozjechać się z rzeczywistością, bo nie jest kopiowany, tylko wyliczany.

**Reguła `R25-occupancy-integrity`.** Sprawdza obecność wszystkich czterech guardów, że każdy odrzuca naruszenie zamiast je po cichu przyjmować, że niezmiennik jeden-do-jednego jest zapisany jawnie, że rejestr nie jest czytelny dla ról bliskich (numer łóżka jest informacją logistyczną placówki, nie czymś udostępnianym na zewnątrz bez potrzeby) i że widok obłożenia filtruje po aktywnym przypisaniu. Mutacja zmienia reakcję guarda z `REJECT` na `OVERWRITE` i sprawdza, czy bramka się zapala — bo ciche nadpisanie jest gorsze niż brak guarda, wygląda na zabezpieczone, a nim nie jest.

**Dwie reguły hooka.** `adr012-bed-count-write` blokuje ręczny zapis do pola pochodnego. `adr012-assignment-without-close` blokuje tworzenie nowego przypisania poza funkcją przenoszącą albo przyjmującą — otwarcie przypisania bez zamknięcia poprzedniego w tej samej operacji łamie regułę jeden-do-jednego równie skutecznie jak brak guarda w bazie.

**Co pozostaje otwarte.** Wymaganie nie rozstrzyga, czy przypisanie do łóżka jest obowiązkowe przy przyjęciu, czy może nastąpić później — `ADM-RESIDENT-ADD` traktuje brak przypisania jako stan poprawny. Jeśli w praktyce każdy przyjęty pensjonariusz od razu dostaje łóżko, wymaganie da się zaostrzyć, ale to decyzja operacyjna, nie architektoniczna.

---

## ADR-013 — PITR i pgAudit odłożone, audit_logs zostaje ✅

**Kontekst.** `TASK-INFRA-01` wymagał planu Supabase Pro dla dwóch funkcji: odtwarzania do punktu w czasie (PITR) i rozszerzenia `pgAudit` na poziomie bazy. Michał nie chce ponosić tego kosztu na etapie MVP.

**Rozróżnienie, które trzeba było zrobić przed zmianą.** „Audyt" w tym systemie to dwa niezależne mechanizmy, które łatwo pomylić pod jedną nazwą:

| | `TASK-INFRA-01` (PITR/pgAudit) | `SEC-AUDIT-APPEND-ONLY` (`audit_logs`) |
|---|---|---|
| Poziom | Infrastruktura Supabase | Aplikacja, zwykła tabela Postgresa |
| Koszt | Wymaga planu Pro | Darmowy plan wystarcza |
| Co daje | Odtworzenie stanu bazy co do sekundy, log każdego odczytu | Ślad kto/kiedy/dlaczego dla sześciu operacji wrażliwych |
| Od czego zależą | Nic w kontrakcie | `SUP-IMPERSONATION`, `ADM-ARCHIVE`, `CONSENT-REVOKE` |

Obniżenie priorytetu obu naraz cicho pozbawiłoby impersonację super administratora, twarde usunięcie danych i cofnięcie zgody jedynego mechanizmu rozliczalności, jaki mają. Żadne z tych trzech wymagań nie jest opcjonalne przy danych artykułu 9.

**Decyzja (Michał, 2026-08-27): rozdzielić.** `INFRA-PITR` odłożone. `audit_logs` zostaje aktywne, bo nic nie kosztuje i trzy inne wymagania wysokiego ryzyka na nim polegają.

**Wykonane.** Nowy status `DEFERRED` w rejestrze wymagań — piąty obok `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`. Różni się od `BLOCKED` tym, że nic nie blokuje realizacji, decyzja jest świadomie przesunięta. Wymaga dwóch pól, których nie ma żaden inny status: `deferredReason` i `deferredUntil` — bo „później" bez konkretnego warunku powrotu w praktyce znaczy „nigdy", a rejestr miałby wtedy wymaganie, które wygląda na aktywne, ale nikt go nie zobaczy.

`INFRA-PITR` ma teraz oba pola wypełnione: powód (koszt planu Pro, pokrycie przez `audit_logs` na razie wystarczające) i warunek powrotu (decyzja o skalowaniu poza pilotaż albo pierwszy incydent wymagający odtworzenia stanu bazy co do sekundy).

**Reguła `R19-req-shape` rozszerzona.** Status `DEFERRED` bez `deferredReason` albo bez `deferredUntil` jest błędem, nie ostrzeżeniem — inaczej odłożenie stałoby się furtką do cichego porzucenia wymagania bez śladu. Wymaganie odłożone poprawnie generuje jawne ostrzeżenie przy każdym uruchomieniu walidatora, więc nie zniknie z pola widzenia mimo że nie blokuje bramki. Mutacja usuwa `deferredUntil` i sprawdza, czy bramka się zapala.

**`SEC-AUDIT-APPEND-ONLY` przepisane, żeby rozróżnienie było jawne w samym kontrakcie**, nie tylko w tym dokumencie — treść wymagania teraz wprost mówi, że nie zależy od PITR/pgAudit.

**Koszt na etapie MVP: zero złotych za Supabase**, obok wcześniej ustalonego zera za Groq (ADR-009). Jedyne stałe koszty to dostawcy, których nie da się uniknąć — model językowy, SMS, e-mail.
