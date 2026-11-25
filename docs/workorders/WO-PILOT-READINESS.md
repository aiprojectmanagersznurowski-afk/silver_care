# Odbiór pilotażu dwóch placówek

Poprawki są na `fix/pilot-readiness` w szkicu PR #321, którego bazą jest `codex/nowe-zmiany` (`2345e1b4`, PR #313). Audyt objął też `origin/staging` (`d8ed892b`). Start przewiduje dwie puste placówki po około 60 podopiecznych i dwie opiekunki na zmianę w każdej.

| Pakiet | Co działa i jak to sprawdzono | Co pozostaje do odbioru |
|---|---|---|
| Wydanie i MFA | Workflow porządkuje wydanie do stagingu jako weryfikacja → publikacja kandydata → migracje → przełączenie aliasu (`0c6ab0ad`). Push automatyczny ma jeden jawny cel i refspec (`ca08368b`). | Uprawniony operator Vercela uruchamia próbę stagingu. Przed migracją sprawdza historyczne duplikaty oraz zgodność aplikacji pod obecnym aliasem z nowym schematem. Po wydaniu sprawdza logowanie z MFA i wprost weryfikuje alias. |
| Nagrania i retencja | Treść po przedstawieniu pozostaje w pierwszym nagraniu. Telefon pozwala ponowić odrzuconą wysyłkę lub pobrać nagranie. Retencja obejmuje pliki po częściowym zapisie, szkice i raporty operacyjne (`ca08368b`, `cee849e6`, `0fbd2c4f`). | Próba przeciążenia pod koniec zmiany i obserwacja zaległości kolejki w środowisku pilotażowym. |
| Role, pliki i publikacja | Podgląd importu i transkrypcja sprawdzają role i MFA. Pliki podopiecznych są ograniczone do placówki i uprawnionego zakresu. Zbiorcza publikacja wymaga indywidualnego przeglądu oznaczonego szkicu (`d1950a05`, `4244230f`, `b2068ef3`). | Odbiór ról na stagingu po wydaniu. |
| Zgody rodziny | Decyzja z 25.11.2026 włącza każdy dostęp dopiero po zapisaniu zgody na dany cel. Raporty i metryki mają osobne zgody. Powiadomienia sprawdzają aktualną zgodę. `family_view_basic` zostaje w historii, a kierownik zapisuje potwierdzoną zgodę z wpisem audytowym (`6dd9682b`, `1cc65960`, `3f9262b9`, `52250e29`, `795dc25d`, `2e411cc9`). | Przed startem kierownik przygotowuje potwierdzenia podopiecznych lub opiekunów prawnych. Brak zapisu dla celu oznacza brak dostępu w tym zakresie także na istniejącym koncie bliskiego. |
| Import i limit | Excel i CSV są odczytywane po nagłówkach. Pokoje z łóżkami oraz podopieczni zapisują się całymi paczkami. Przekroczenie limitu wymaga potwierdzenia i tworzy wpis audytu (`40be45cd`, `7a88a77b`, `28cad357`, `e06adf55`, `f5cadf1b`, `35308a80`). Lokalna baza z prawami kierownika zapisała po 30 pokoi, 60 łóżek i 60 podopiecznych w obu syntetycznych placówkach. Powtórzenie nie dodało rekordów. | Dwa zanonimizowane układy arkuszy, w tym nagłówki i przykładowe oznaczenia pokoju i łóżka. Odwzorować oba eksporty, potwierdzić przypisania i sprawdzić pełny setup przez przeglądarkę. [#308](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/308) |
| Urządzenia i zgodność | Weryfikacja napraw obejmuje lokalną aplikację, bazę i syntetyczne nagrania. | Rozstrzygnąć kontraktowe miejsce zapisu `COMMIT` (`voice_draft_notes` wobec `voice_captures`). Potwierdzić przyjęcie, retransmisję i zgodność niezależnego wykazu wysyłek. Uzgodnić dokumentację i konfigurację podmiotów przetwarzających, retencję dostawców i DPIA. [Sprzęt #307](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/307), [formalizacja #306](https://github.com/aiprojectmanagersznurowski-afk/silver_care/issues/306) |

## Próba operacyjna według ról

| Rola | Scenariusz odbioru |
|---|---|
| Administrator platformy | Tworzy dwie placówki, ustawia ich faktyczne limity, aktywuje moduły i konta kierowników. Sprawdza zaproszenia, logowanie z MFA i niezależność konfiguracji. |
| Kierownik placówki | Importuje pokoje, łóżka i podopiecznych. Sprawdza zajętość, przypisania i obsługę błędu w pliku. Zapisuje zgody według celu, ustawia grafik dwóch opiekunek i osobę prowadzącą zmianę. |
| Opiekunka | Rejestruje pracę w trakcie reprezentatywnej zmiany. Sprawdza ponowienie wysyłki, dostęp do własnych szkiców i odzyskanie pracy po przerwie. |
| Kierownik zmiany | Rozstrzyga przypisania, kontroluje szkice wymagające przejrzenia i przekazuje zmianę wraz z otwartymi zadaniami. Porównuje kolejkę z niezależnym wykazem wysyłek. |
| Bliski i opiekun prawny | Potwierdzają zakres portalu przed zgodą, po udzieleniu każdego celu i po cofnięciu. Sprawdzają oddzielnie metryki, raporty i powiadomienia, także na istniejących kontach. |

W obu placówkach zapisać osobno minuty konfiguracji i minuty pracy na zmianie. Porównać obecną i nową obsługę tej samej liczby zadań, wliczając pracę obu opiekunek, korekty, ponowienia, czynności kierownika i przekazanie dyżuru. Odbiór wymaga dodatniego bilansu czasu przy zachowaniu kompletu zdarzeń i obowiązkowych decyzji człowieka. Lokalny pomiar czasu SQL opisuje wyłącznie zapis w bazie.

## RODO i AI Act

- Przed użyciem prawdziwych danych uzgodnić podstawy przetwarzania, zakres danych szczególnych kategorii, dokumentację powierzenia i ewentualnych transferów oraz udokumentować ocenę skutków. Dla każdej produkcyjnej ścieżki STT i LLM potwierdzić faktycznego dostawcę, region i ustawienia retencji. Szczególnie sprawdzić ścieżkę starszej transkrypcji surowego audio i wyłączenie demonstracyjnego fallbacku przy realnych danych. [RODO](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- Udokumentować przeznaczenie systemu komunikacji i organizacji pracy, ocenę klasyfikacji, przewidziany udział personelu, przeszkolenie użytkowników i zakres obowiązków przejrzystości przed startem. [AI Act, art. 4, 6 i 50](https://eur-lex.europa.eu/eli/reg/2024/1689)

## Wznowienie

1. Pobierz `origin/fix/pilot-readiness` i sprawdź stan PR #321. Poprawki mają trafić najpierw do gałęzi PR #313. GitHubowa bramka PR nie uruchamia publikacji kandydata ani migracji stagingu.
2. Odtwórz bazę lokalną na danych syntetycznych i odtwórz zestaw regresji. `bash scripts/verify.sh --full` obejmuje bramkę kodu. Testy Supabase i Playwright mają osobne polecenia. Pełny zestaw DB w czasie audytu miał również awarie PostgreSQL i testy zakładające domyślny port. Testy celowane na zmianach pilota przeszły.
3. Przed migracją unikalności policz grupy duplikatów bez ujawniania hashy lub nazwisk. Uzgodnij każdą kolizję przed zastosowaniem migracji. Użyj `SELECT count(*) FROM (SELECT 1 FROM public.residents WHERE pesel_hash IS NOT NULL GROUP BY organization_id, pesel_hash HAVING count(*) > 1) AS conflicts;`.
4. Po otrzymaniu dwóch zanonimizowanych plików zacznij od mapowania pokoju i łóżka, następnie przejdź przez oba setupy i pomiar zmian. SC-ADM-13 obejmuje masowy import osób. Zmiana zakresu kontraktu wymaga aktualizacji story i okna otwieranego przez człowieka.
5. Po decyzji o `COMMIT` przejdź do #307, uzgodnij protokół i sprawdź niezależny wykaz. Odbiór stagingu i zgody na przetwarzanie prawdziwych danych pozostają po stronie uprawnionych osób.
