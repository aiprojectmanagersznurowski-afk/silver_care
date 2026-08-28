// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const REQUIREMENTS = [
  {
    "id": "ORG-ISOLATION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-SUP-03/AC4",
    "domain": "tenancy",
    "statement": "Każda placówka ma własny organization_id, a wszystkie polityki RLS izolują do niego dane.",
    "acceptance": [
      "Zapytanie konta z placówki A nie zwraca żadnego wiersza placówki B",
      "Izolacja działa na poziomie bazy, nie aplikacji — test wykonuje surowe zapytanie SQL z tokenem obcej placówki",
      "Nowy rekord dziedziczy organization_id z tokenu, nie z ciała żądania"
    ]
  },
  {
    "id": "ORG-PROVISION",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-SUP-03/AC3",
    "domain": "tenancy",
    "statement": "Utworzenie placówki tworzy pierwszego org_admin i wysyła mu zaproszenie.",
    "acceptance": [
      "Rekord organizations powstaje wyłącznie przez super_admin",
      "Konto org_admin powstaje w tej samej transakcji",
      "Zaproszenie nie zawiera danych osobowych pensjonariuszy"
    ]
  },
  {
    "id": "SUP-IMPERSONATION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-SUP-02",
    "domain": "tenancy",
    "statement": "Super admin może działać jako administrator placówki w celu diagnostyki.",
    "acceptance": [
      "Token impersonacji wygasa po godzinie",
      "Każde użycie zapisuje wpis w audit_logs z ID obu stron",
      "W trybie impersonacji nie da się usunąć konta ani zmienić ustawień bezpieczeństwa"
    ]
  },
  {
    "id": "ADM-RESIDENT-ADD",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-02, ADR-012",
    "domain": "residents",
    "statement": "Administrator dodaje pensjonariusza, przypisuje bliskich i przypisuje łóżko.",
    "acceptance": [
      "PESEL zapisany wyłącznie jako hash z solą — brak wartości jawnej w bazie i w logach",
      "organization_id pochodzi z tokenu administratora",
      "Powiązanie zapisuje kod relacji i rolę bliskiego",
      "Przyjęcie może, ale nie musi, obejmować od razu przypisanie łóżka — pensjonariusz bez przypisania jest stanem poprawnym, nie błędem",
      "Próba przypisania zajętego łóżka jest odrzucana z czytelnym komunikatem, nie nadpisuje istniejącego przypisania"
    ]
  },
  {
    "id": "ADM-FACILITY-MANAGE",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-012",
    "domain": "facility",
    "statement": "Administrator zarządza rejestrem pokoi i łóżek placówki.",
    "acceptance": [
      "Dodanie, edycja i dezaktywacja pokoju nie usuwa historii przypisań",
      "Numer pokoju unikalny w obrębie placówki — próba duplikatu jest odrzucana z czytelnym komunikatem",
      "Etykieta łóżka unikalna w obrębie pokoju, nie globalnie",
      "Dezaktywacja łóżka z aktywnym przypisaniem jest odrzucana — trzeba najpierw zamknąć przypisanie",
      "bed_count na pokoju jest polem pochodnym, nie edytowanym ręcznie"
    ]
  },
  {
    "id": "ADM-BED-ASSIGNMENT",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-012",
    "domain": "facility",
    "statement": "Jedno łóżko ma co najwyżej jednego aktywnego pensjonariusza; jeden pensjonariusz ma co najwyżej jedno aktywne łóżko.",
    "acceptance": [
      "Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane na poziomie bazy, nie tylko interfejsu",
      "Przeniesienie pensjonariusza to jedna operacja zamykająca stare przypisanie i otwierająca nowe w tej samej transakcji",
      "Historia przypisań zachowana — zamknięte przypisanie ma unassigned_at, nie jest usuwane",
      "Zarchiwizowany pensjonariusz nie może dostać nowego przypisania"
    ]
  },
  {
    "id": "ADM-FACILITY-OCCUPANCY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-012",
    "domain": "facility",
    "statement": "Administrator widzi obłożenie pokoi bez ręcznego liczenia.",
    "acceptance": [
      "Liczba wolnych łóżek wyliczana z aktywnych przypisań, nie przechowywana osobno",
      "Widok aktualizuje się natychmiast po zmianie przypisania — nie ma opóźnienia ani cache do odświeżenia ręcznie"
    ]
  },
  {
    "id": "ADM-INVITE",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-08",
    "domain": "residents",
    "statement": "Zaproszenie dla bliskiego jest bezpieczne i nie ujawnia danych osobowych.",
    "acceptance": [
      "Treść e-maila nie zawiera imienia, nazwiska ani PESEL pensjonariusza",
      "Token wygasa po siedmiu dniach",
      "Administrator może unieważnić zaproszenie przed rejestracją"
    ]
  },
  {
    "id": "ADM-ARCHIVE",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-05",
    "domain": "residents",
    "statement": "Archiwizacja odcina dostęp bliskim bez niszczenia śladu audytowego.",
    "acceptance": [
      "archived_at ukrywa pensjonariusza przed bliskimi natychmiast",
      "Personel zachowuje wyłącznie odczyt",
      "Ingest odrzuca nowe dane dla zarchiwizowanego pensjonariusza",
      "Twarde usunięcie redaguje dane osobowe w audit_logs zamiast kasować wpisy"
    ]
  },
  {
    "id": "SEC-MFA-STAFF",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-07, NFR-SEC-02",
    "domain": "security",
    "statement": "Personel loguje się z drugim składnikiem; rodziny bez MFA.",
    "acceptance": [
      "Rola z MFA_REQUIRED_ROLES bez potwierdzonego drugiego składnika nie odczyta żadnej tabeli z danymi pensjonariuszy",
      "Blokada działa na poziomie bazy, nie tylko w interfejsie",
      "Konta rodzin logują się bez drugiego składnika"
    ]
  },
  {
    "id": "SEC-SESSION",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "NFR-SEC-05",
    "domain": "security",
    "statement": "Użytkownik zarządza swoimi sesjami, a sesje personelu wygasają po bezczynności.",
    "acceptance": [
      "Wylogowanie ze wszystkich urządzeń unieważnia wszystkie tokeny",
      "Sesja personelu nieaktywna ponad trzydzieści minut jest unieważniana"
    ]
  },
  {
    "id": "CONSENT-GRANTOR",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-003",
    "domain": "consent",
    "statement": "Zgodę na przetwarzanie danych o zdrowiu może wyrazić wyłącznie pensjonariusz lub jego opiekun prawny.",
    "acceptance": [
      "Próba zapisu zgody z rolą family kończy się odmową na poziomie bazy",
      "granted_by wskazuje konto z rolą legal_guardian albo oznaczenie resident_self",
      "Zgoda dotyczy konkretnego celu z CONSENT_PURPOSES, nigdy nie jest globalna"
    ]
  },
  {
    "id": "CONSENT-REVOKE",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-003",
    "domain": "consent",
    "statement": "Cofnięcie zgody natychmiast zatrzymuje przetwarzanie w danym celu.",
    "acceptance": [
      "revoked_at odcina dostęp w tej samej sekundzie — bez czekania na kolejny cykl",
      "Ingest odrzuca dane po cofnięciu zgody na wellness_data_ingest",
      "Cofnięcie zapisuje wpis w audit_logs z podstawą CONSENT_WITHDRAWN",
      "Rekordy zgód nie są aktualizowane ani kasowane — historia jest niezmienialna"
    ]
  },
  {
    "id": "CONSENT-LEDGER-IMMUTABLE",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-FAM-02/AC2, ADR-003",
    "domain": "consent",
    "statement": "Rejestr zgód jest niezmienialny.",
    "acceptance": [
      "Macierz uprawnień nie przyznaje update ani delete żadnej roli",
      "Cofnięcie zgody to nowy stan przez revoked_at, nie edycja wiersza",
      "Opiekun prawny ma wyłącznie odczyt swojego rejestru"
    ]
  },
  {
    "id": "MDR-NO-PHYSIO-TO-FAMILY",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-005",
    "domain": "presentation",
    "statement": "Bliscy widzą metryki behawioralne; parametry fizjologiczne nie mają ścieżki do portalu rodziny.",
    "acceptance": [
      "Widok rodziny zwraca wyłącznie pola z FAMILY_VISIBLE_METRICS",
      "Żadne pole z PHYSIOLOGICAL_FIELDS nie występuje w odpowiedzi API dla roli family ani legal_guardian",
      "Dane fizjologiczne są zapisane w bazie i dostępne personelowi — zakaz dotyczy prezentacji, nie zbierania"
    ]
  },
  {
    "id": "MDR-NO-INTERPRETATION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-005, MVP §Ryzyko MDR",
    "domain": "presentation",
    "statement": "System opisuje fakty o zachowaniu i nie ocenia stanu zdrowia.",
    "acceptance": [
      "Prompt modelu zawiera zakaz oceny, diagnozy i prognozy",
      "Raport nie zawiera sformułowań z MDR_GUARDRAILS.forbiddenStatements",
      "Anomalia opisywana jest jako fakt harmonogramowy, nie jako podejrzenie stanu chorobowego"
    ]
  },
  {
    "id": "MDR-NO-METRIC-ALARM",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-FAM-03/AC2",
    "domain": "presentation",
    "statement": "Żadna metryka nie wyzwala powiadomienia.",
    "acceptance": [
      "Jedynym wyzwalaczem powiadomienia jest publikacja raportu",
      "Spadek liczby kroków ani żadna inna wartość nie generuje powiadomienia push",
      "Aplikacja jest cicha wobec danych z urządzenia"
    ]
  },
  {
    "id": "MDR-VOCABULARY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-ADM-03/AC1, ADR-004",
    "domain": "presentation",
    "statement": "W warstwie widocznej dla użytkownika nie występuje słowo „pacjent\" ani język kliniczny.",
    "acceptance": [
      "Treści interfejsu i raportów używają określeń podopieczny, senior, pensjonariusz",
      "Identyfikatory techniczne w bazie mogą pozostać angielskie",
      "Bramka blokuje zakazane terminy w plikach warstwy prezentacji"
    ]
  },
  {
    "id": "UI-FOUR-STATES",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "NFR-UI-01/AC1",
    "domain": "presentation",
    "statement": "Każdy komponent prezentujący dane ma cztery stany.",
    "acceptance": [
      "Loading, empty, success i error są zaimplementowane i widoczne w Storybooku",
      "Stan empty dla nowego pensjonariusza informuje, kiedy pojawi się pierwszy raport"
    ]
  },
  {
    "id": "UI-ACCESSIBILITY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "NFR-UI-01/AC3",
    "domain": "presentation",
    "statement": "Interfejs spełnia WCAG 2.1 na poziomie AA.",
    "acceptance": [
      "Kontrast tekstu spełnia próg AA",
      "Interfejs działa przy powiększeniu tekstu do 200%",
      "Nawigacja klawiaturą obejmuje wszystkie akcje"
    ]
  },
  {
    "id": "VOICE-ZERO-GUESSING",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-02/AC2, ADR-006",
    "domain": "voice",
    "statement": "Model nigdy nie ustala tożsamości pensjonariusza z nagrania.",
    "acceptance": [
      "Żądanie rozpoczęcia nagrania zawiera resident_id jako UUID z frontendu",
      "Transkrypt wysyłany do modelu nie zawiera imienia, nazwiska ani identyfikatora",
      "Złączenie treści z tożsamością następuje w pamięci funkcji brzegowej przed zapisem",
      "Brak resident_id w żądaniu kończy się odmową, nie próbą rozpoznania"
    ]
  },
  {
    "id": "VOICE-MEDICAL-STRIP",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-007",
    "domain": "voice",
    "statement": "Dane medyczne są usuwane z transkryptu przed wysłaniem do modelu.",
    "acceptance": [
      "Etap REDACT wykonuje się przed etapem GENERATE",
      "Model generujący raport nie otrzymuje nazw leków, diagnoz ani wyników badań",
      "Oryginalna treść medyczna zapisywana jest wyłącznie w brudnopisie personelu",
      "Wykrycie kategorii z MEDICAL_CATEGORIES kieruje fragment do strumienia MEDICAL"
    ]
  },
  {
    "id": "VOICE-DRAFT-ISOLATION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-02/AC1",
    "domain": "voice",
    "statement": "Brudnopis personelu jest niedostępny dla bliskich.",
    "acceptance": [
      "Macierz uprawnień nie daje rolom bliskich odczytu daily_logs",
      "Test wykonuje zapytanie kontem rodziny i otrzymuje zero wierszy"
    ]
  },
  {
    "id": "VOICE-RETENTION",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-02/AC3",
    "domain": "voice",
    "statement": "Surowe nagrania są usuwane po trzydziestu dniach.",
    "acceptance": [
      "Zadanie bazodanowe usuwa wpisy starsze niż TTL",
      "Usunięcie nie kasuje zatwierdzonego raportu"
    ]
  },
  {
    "id": "VOICE-OFFLINE",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-04",
    "domain": "voice",
    "statement": "Dyktafon działa bez łączności i synchronizuje się po jej odzyskaniu.",
    "acceptance": [
      "Nagranie zapisuje się lokalnie przy braku sieci",
      "Interfejs pokazuje tryb offline i liczbę oczekujących nagrań",
      "Po odzyskaniu połączenia nagrania wysyłają się automatycznie",
      "Nagranie nie ginie przy zamknięciu karty przeglądarki"
    ]
  },
  {
    "id": "VOICE-FOLLOWUP",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-02/Przypadek 2",
    "domain": "voice",
    "statement": "Przy zbyt ubogiej notatce asystent dopytuje zamiast uzupełniać treść samodzielnie.",
    "acceptance": [
      "Model zwraca polecenie follow_up z konkretnym pytaniem",
      "Model nie generuje treści, której nie było w nagraniu",
      "Odpowiedź personelu dołącza się do tej samej rozmowy"
    ]
  },
  {
    "id": "REPORT-APPROVAL",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-03",
    "domain": "reports",
    "statement": "Raport trafia do bliskich dopiero po zatwierdzeniu przez personel.",
    "acceptance": [
      "Status published i approved_by ustawiane w jednej operacji",
      "Przed zatwierdzeniem RLS nie udostępnia raportu bliskim",
      "Raport nosi etykietę o udziale AI wymaganą przez EU AI Act",
      "Metadane modelu i wersji promptu zapisane przy generowaniu"
    ]
  },
  {
    "id": "REPORT-AI-FEEDBACK",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-COMP-01",
    "domain": "reports",
    "statement": "Personel może zgłosić błąd w raporcie wygenerowanym przez AI.",
    "acceptance": [
      "Zgłoszenie wymaga wyboru kategorii z AI_FEEDBACK_CATEGORIES",
      "Zapisywana jest migawka tekstu i wersja promptu",
      "Zgłoszenie blokuje publikację raportu"
    ]
  },
  {
    "id": "INT-CORE-DECOUPLED",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-002",
    "domain": "integration",
    "statement": "Identyfikatory zewnętrzne nie występują na tabelach rdzenia.",
    "acceptance": [
      "residents nie ma kolumny polar_user_id ani żadnej innej kolumny dostawcy",
      "Powiązanie żyje w external_wearable_links z kolumną provider",
      "Dodanie drugiego dostawcy nie wymaga migracji tabel rdzenia"
    ]
  },
  {
    "id": "INT-INGEST-PRECONDITIONS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-002, SC-ADM-05/AC3",
    "domain": "integration",
    "statement": "Ingest zapisuje dane wyłącznie przy spełnieniu wszystkich warunków wstępnych.",
    "acceptance": [
      "Brak aktywnej zgody odrzuca paczkę i zapisuje powód",
      "Zarchiwizowany pensjonariusz odrzuca paczkę",
      "Powtórzona paczka nie tworzy drugiego wiersza",
      "Odrzucenie zapisuje ślad bez danych osobowych"
    ]
  },
  {
    "id": "INT-NORMALIZATION",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "ADR-002",
    "domain": "integration",
    "statement": "Dane dostawcy są normalizowane do pól kanonicznych.",
    "acceptance": [
      "Czas trwania w formacie ISO 8601 zamieniany na minuty",
      "Każde pole kanoniczne ma jawne mapowanie w FIELD_MAPPINGS",
      "Pole bez mapowania nie jest zapisywane"
    ]
  },
  {
    "id": "INT-SYNC-STALENESS",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-03/AC3",
    "domain": "integration",
    "statement": "Brak synchronizacji dłuższy niż próg jest komunikowany opisowo.",
    "acceptance": [
      "Komunikat informuje o zasięgu urządzenia, nie o stanie zdrowia",
      "Komunikat nie jest powiadomieniem push ani alarmem"
    ]
  },
  {
    "id": "FAM-ONBOARDING",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-01",
    "domain": "family",
    "statement": "Bliski zakłada konto z zaproszenia i akceptuje zgody.",
    "acceptance": [
      "Wygasły lub unieważniony token pokazuje czytelny komunikat",
      "Po rejestracji powstaje powiązanie z rolą ustaloną przez administratora",
      "Akceptacja regulaminu i zgód jest warunkiem aktywacji konta"
    ]
  },
  {
    "id": "FAM-DASHBOARD",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-03",
    "domain": "family",
    "statement": "Bliski widzi najnowszy zatwierdzony raport dnia.",
    "acceptance": [
      "Widok pobiera wyłącznie rekordy ze statusem published",
      "Przed publikacją widoczny jest raport z dnia poprzedniego z jawną datą",
      "Brak raportu pokazuje stan pusty z informacją, kiedy się pojawi"
    ]
  },
  {
    "id": "FAM-MULTI-RESIDENT",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-05",
    "domain": "family",
    "statement": "Bliski powiązany z kilkoma pensjonariuszami przełącza kontekst.",
    "acceptance": [
      "Przełącznik pojawia się tylko przy więcej niż jednym aktywnym powiązaniu",
      "Zmiana kontekstu przeładowuje dane wyłącznie wybranego pensjonariusza"
    ]
  },
  {
    "id": "FAM-MESSAGES",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-04",
    "domain": "family",
    "statement": "Bliski zostawia wiadomość dla personelu bez dzwonienia na dyżurkę.",
    "acceptance": [
      "Wiadomości są niezmienialne po wysłaniu",
      "Limit trzech wiadomości na godzinę na konto",
      "Przekroczenie limitu pokazuje czytelny komunikat, nie błąd techniczny",
      "Wysyłka wymaga aktywnego powiązania"
    ]
  },
  {
    "id": "FAM-AGENDA",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-FAM-06",
    "domain": "family",
    "statement": "Bliski widzi plan dnia pensjonariusza.",
    "acceptance": [
      "Widok łączy pozycje indywidualne i wspólne dla placówki",
      "Dostęp ograniczony do pensjonariuszy z aktywnym powiązaniem",
      "Brak planu pokazuje stan pusty"
    ]
  },
  {
    "id": "NUR-BOARD",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-01, SC-NUR-06",
    "domain": "staff",
    "statement": "Personel widzi tablicę pensjonariuszy ze statusem notatek.",
    "acceptance": [
      "Widoczni wyłącznie pensjonariusze własnej placówki",
      "Status notatki rozróżnia gotową, wersję roboczą i brak wpisu",
      "Filtrowanie po sektorze i piętrze"
    ]
  },
  {
    "id": "NUR-AGENDA",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-05",
    "domain": "staff",
    "statement": "Personel zarządza planem dnia placówki.",
    "acceptance": [
      "Wpis ma typ, tytuł, godzinę i oznaczenie czy dotyczy wszystkich",
      "Szablony dnia pozwalają nie wpisywać powtarzalnych pozycji ręcznie",
      "Wpis dziedziczy organization_id z tokenu"
    ]
  },
  {
    "id": "NTF-REPORT-READY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "MVP §8",
    "domain": "notifications",
    "statement": "Bliscy otrzymują powiadomienie o dostępności raportu.",
    "acceptance": [
      "Wysyłka następuje po publikacji, nie po wygenerowaniu wersji roboczej",
      "Treść nie zawiera danych o zdrowiu ani metryk",
      "Kanał zgodny z preferencją odbiorcy"
    ]
  },
  {
    "id": "NTF-NO-PII",
    "status": "TODO",
    "risk": "HIGH",
    "source": "NFR-SEC-01, MVP §8",
    "domain": "notifications",
    "statement": "Treść powiadomienia nie zawiera danych osobowych ani zdrowotnych.",
    "acceptance": [
      "Wiadomość zawiera wyłącznie zachętę do otwarcia portalu",
      "Brak imienia, nazwiska i jakiejkolwiek metryki w treści",
      "Test sprawdza szablony, nie tylko pojedynczą wysyłkę"
    ]
  },
  {
    "id": "SEC-NO-PII-LOGS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "NFR-SEC-01, ADR-008",
    "domain": "security",
    "statement": "Dane osobowe i zdrowotne nie trafiają do logów ani do monitoringu.",
    "acceptance": [
      "Kod nie loguje obiektów zawierających dane pensjonariusza",
      "Obsługa błędów operuje na identyfikatorach UUID i kodach technicznych",
      "Bramka blokuje logowanie zmiennych o nazwach wskazujących na dane osobowe"
    ]
  },
  {
    "id": "SEC-AUDIT-APPEND-ONLY",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-008",
    "domain": "security",
    "statement": "Rejestr audytowy (tabela audit_logs, budowana przez aplikację) jest niezmienialny. NIE zależy od PITR/pgAudit z INFRA-PITR — to dwa różne mechanizmy, pierwszy działa na planie darmowym Supabase, drugi wymaga planu Pro (patrz ADR-013).",
    "acceptance": [
      "RLS odrzuca update i delete dla wszystkich ról łącznie z super_admin",
      "Każda operacja z AUDIT_REQUIREMENTS.mustLog tworzy wpis w tej samej transakcji",
      "Wycofanie transakcji operacji wycofuje też wpis audytowy"
    ]
  },
  {
    "id": "SEC-403-LOGGING",
    "status": "TODO",
    "risk": "HIGH",
    "source": "NFR-SEC-04",
    "domain": "security",
    "statement": "Odmowy dostępu są rejestrowane i alarmują przy serii prób.",
    "acceptance": [
      "Każda odmowa RLS zapisuje wpis z kontekstem technicznym",
      "Dziesięć nieudanych prób z jednego adresu w ciągu minuty generuje alert",
      "Wpis nie zawiera danych osobowych"
    ]
  },
  {
    "id": "SEC-PESEL-HASH",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-02/AC1",
    "domain": "security",
    "statement": "PESEL przechowywany wyłącznie jako hash z solą.",
    "acceptance": [
      "Brak kolumny z wartością jawną",
      "Sól nie jest zapisana w tym samym rekordzie",
      "Wyszukiwanie duplikatu działa na hashu"
    ]
  },
  {
    "id": "SEC-RETENTION",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-ADM-05/AC4",
    "domain": "security",
    "statement": "System ma zautomatyzowaną politykę retencji danych archiwalnych.",
    "acceptance": [
      "Po upływie okresu retencji następuje nieodwracalne usunięcie",
      "W rejestrze audytowym zostaje wpis bez danych osobowych",
      "Usunięcie retencyjne jest jedyną dozwoloną operacją kasującą na audit_logs i wykonuje je zadanie bazodanowe"
    ]
  },
  {
    "id": "INFRA-PITR",
    "status": "DEFERRED",
    "risk": "MEDIUM",
    "source": "TASK-INFRA-01/AC1",
    "domain": "infra",
    "statement": "Baza produkcyjna ma odtwarzanie do punktu w czasie i rozszerzenie pgAudit.",
    "acceptance": [
      "PITR aktywne na instancji produkcyjnej",
      "Rozszerzenie pgAudit włączone, każdy odczyt danych wrażliwych generuje ślad",
      "Procedura odtworzenia przetestowana przynajmniej raz przed pilotażem"
    ],
    "deferredReason": "ADR-013: wymaga planu Supabase Pro. audit_logs budowane przez aplikację (SEC-AUDIT-APPEND-ONLY) pokrywa rozliczalność operacji wrażliwych na planie darmowym — PITR/pgAudit to dodatkowa warstwa na poziomie infrastruktury, nie jedyny mechanizm.",
    "deferredUntil": "Decyzja o skalowaniu poza pilotaż (Michał) albo pierwszy incydent wymagający odtworzenia stanu bazy co do sekundy."
  },
  {
    "id": "INFRA-EU-REGION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "MVP §Architektura",
    "domain": "infra",
    "statement": "Dane nie opuszczają Europejskiego Obszaru Gospodarczego, poza jawnie udokumentowanymi wyjątkami.",
    "acceptance": [
      "Baza i hosting w regionie EU",
      "Dostawca modelu językowego generującego raport ma umowę powierzenia i nie przechowuje zapytań",
      "Dostawca powiadomień działa w EOG",
      "Każdy nowy dostawca wymaga potwierdzenia lokalizacji przed włączeniem",
      "Wyjątek od reguły dopuszczalny wyłącznie z transferMechanism, exceptionApprovedBy i exceptionReason w PROVIDERS — patrz ADR-009"
    ]
  },
  {
    "id": "INFRA-GROQ-TRANSCRIPTION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-009",
    "domain": "infra",
    "statement": "Transkrypcja surowego audio odbywa się przez Groq (USA, transfer na bazie SCC) wyłącznie na etapie TRANSCRIBE, przed redakcją danych medycznych.",
    "acceptance": [
      "Klucz GROQ_API_KEY występuje wyłącznie po stronie serwera, nigdy w warstwie klienta",
      "Zerowa retencja jest ręcznie potwierdzona i włączona w panelu Groq przed pierwszym wdrożeniem produkcyjnym — nie zakładana jako domyślna",
      "Model generujący raport dla bliskich działa w infrastrukturze UE, nie w Groq",
      "Przekroczenie darmowego limitu (2000 żądań/dzień, 8h audio/dzień) jest monitorowane, żeby uniknąć nieplanowanych kosztów"
    ]
  }
] as const;

export type RequirementId = typeof REQUIREMENTS[number]['id'];
