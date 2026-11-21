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
    "id": "SUP-IAM-PANEL",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-SUP-04",
    "domain": "tenancy",
    "statement": "Super admin (Power Admin) posiada panel do zarządzania uprawnieniami, rolami użytkowników i ogólnym dostępem do systemu.",
    "acceptance": [
      "Panel widoczny i dostępny wyłącznie dla konta o roli super_admin",
      "Możliwość zarządzania przypisaniem ról do kont użytkowników",
      "Widok audytu zmian uprawnień zintegrowany z audit_logs"
    ]
  },
  {
    "id": "SUP-FEATURE-FLAGS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-SUP-06",
    "domain": "tenancy",
    "statement": "Administrator platformy włącza i wyłącza duże moduły systemowe oraz flagi delegacji uprawnień per placówka z pełnym egzekwowaniem w UI, API, Server Actions i RLS, bez wpływu na niewyłączalny Rdzeń (w tym obowiązkowy rejestr audytowy RODO).",
    "acceptance": [
      "Lista 9 modułów, 2 flag delegacji, wartości domyślne i acykliczny graf zależności istnieją wyłącznie w contracts/features.contract.mjs",
      "Flagi są przechowywane w tabeli organization_feature_flags (nie organizations.settings); bezpośredni INSERT/UPDATE/DELETE z sesji aplikacyjnych jest zablokowany (wyłącznie atomowy RPC set_organization_feature_flag), a zapis w trybie faktycznej impersonacji (sc_impersonation + sesja DB + claim JWT impersonator_id) oraz przez role inne niż super_admin jest odrzucany",
      "Wyłączenie modułu dla placówki A ukrywa jego nawigację i widoki oraz jest egzekwowane w UI, API (z regułą REQUIRE_ALL_MATCHING dla tras wieloflagowych, np. /api/residents/[id]/report/latest), Server Actions oraz w politykach RLS i domenowych RPC (m.in. daily_reports i get_family_resident_overview), bez wpływu na placówkę B i bez wyłączania obowiązkowego audytu RODO",
      "Włączenie flagi bez aktywnego modułu nadrzędnego jest blokowane (FEATURE_DEPENDENCY_DISABLED), a wyłączenie modułu nadrzędnego dezaktywuje wszystkie flagi zależne w jednej transakcji",
      "Każda zmiana flagi (w tym kaskadowa) odkłada niemutowalny wpis ORG_FEATURE_FLAG_UPDATED w audit_logs w tej samej transakcji bez PII"
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
    "id": "NUR-SHIFT-CONFIG",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-NUR-12/AC1",
    "domain": "staff",
    "statement": "Kierownik placówki definiuje 2 albo 3 zmiany na dobę w strefie Europe/Warsaw i układa grafik: kto pracuje na zmianie.",
    "acceptance": [
      "Placówka ma od 2 do 3 aktywnych definicji zmian; zmiana nocna może przechodzić przez północ",
      "Zmiana jest kluczem (definicja, data), nie wierszem tworzonym z wyprzedzeniem",
      "Definicje i grafik zmienia wyłącznie kierownik placówki, personel opiekuńczy ma odczyt",
      "Dane zmian są odizolowane między placówkami"
    ]
  },
  {
    "id": "NUR-SHIFT-LEAD",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-12/AC1a",
    "domain": "staff",
    "statement": "Kierownik zmiany to osoba z personelu opiekuńczego wyznaczona w grafiku, z dodatkowymi uprawnieniami wyłącznie na swojej zmianie.",
    "acceptance": [
      "Na jedną zmianę przypada najwyżej jeden kierownik zmiany",
      "Uprawnienia kierownika zmiany (akceptacja planu, rozliczenie) dotyczą tylko zadań jego zmiany, a poza nią działa jak zwykły personel",
      "Tożsamość i placówka kierownika zmiany pochodzą z sesji i app_metadata, nigdy z parametrów żądania",
      "Zakres shift_lead w macierzy dotyczy wyłącznie zasobów z kluczem zmiany i nigdy odczytu"
    ]
  },
  {
    "id": "NUR-TASKS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-13",
    "domain": "staff",
    "statement": "Zadania zmiany (dla podopiecznego albo placówki) przechodzą akceptację planu przez kierownika zmiany i są rozliczane jako wykonane, anulowane z powodem albo przeniesione na kolejną zmianę.",
    "acceptance": [
      "Każde zadanie ma źródło widoczne dla użytkownika: z przekazania, standardowe (plan opieki), ręczne albo przeniesione z poprzedniej zmiany",
      "Anulowanie zadania wymaga powodu, a niewykonane zadanie przechodzi na kolejną zmianę zamiast znikać",
      "Lista jest grupowana per pokój albo per podopieczny",
      "Zadania są niedostępne dla ról bliskich i nie trafiają do planu dnia współdzielonego z rodziną",
      "Każda zmiana statusu zadania zapisuje wpis w audit_logs bez treści zadania"
    ]
  },
  {
    "id": "NUR-SHIFT-PLAN-PRINT",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-15",
    "domain": "staff",
    "statement": "Kierownik zmiany drukuje zaakceptowany plan pracy zmiany, aby opiekunki pracowały bez obsługi komputera.",
    "acceptance": [
      "Wydruk jest dostępny dopiero po akceptacji planu i niesie wersję planu",
      "Wydruk zawiera wyłącznie pola z SHIFT_TASK_POLICY.printFields, bez PESEL i kontaktów",
      "Każdy wydruk zapisuje wpis w audit_logs: kto, kiedy i którą wersję planu wydrukował"
    ]
  },
  {
    "id": "ADM-RESIDENT-CARD-TASKS",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-ADM-21",
    "domain": "residents",
    "statement": "Karta podopiecznego ma sekcję „Zadania” z otwartymi i niedawno wykonanymi zadaniami podopiecznego.",
    "acceptance": [
      "Sekcja „Zadania” jest w RESIDENT_CARD_SECTIONS i widoczna dla ról z odczytem shift_tasks",
      "Sekcja nie jest dostępna dla ról bliskich",
      "Podopieczny z otwartym zaakceptowanym zadaniem ma znacznik „wymaga uwagi”, który gaśnie po rozliczeniu zadań"
    ]
  },
  {
    "id": "ADM-CARE-PLAN-TASKS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-23",
    "domain": "residents",
    "statement": "Zadania standardowe pochodzą z szablonów planu opieki definiowanych przez placówkę, a nie z rekomendacji systemu.",
    "acceptance": [
      "Szablon zadania standardowego tworzy i zmienia wyłącznie kierownik placówki",
      "System nie podpowiada czynności opiekuńczych na podstawie stanu zdrowia",
      "Zmiana albo wyłączenie szablonu działa od kolejnych zmian i nie modyfikuje rozliczonych zadań",
      "Zalecenia lekarza i harmonogram leków są osobnym źródłem planu opieki i nie są włączone bez osobnego ADR"
    ]
  },
  {
    "id": "ADM-CAPACITY-LIMIT",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-22",
    "domain": "facility",
    "statement": "Limit miejsc placówki (liczba łóżek = maks. liczba aktywnych podopiecznych) ustala wyłącznie super admin; kierownik może go przekroczyć po potwierdzeniu, a przekroczenie powiadamia kierownika i super admina.",
    "acceptance": [
      "Zmianę resident_limit przez rolę inną niż super_admin odrzuca baza, także przy bezpośrednim zapytaniu przez API",
      "Masowy import nie zmienia resident_limit, nawet gdy liczba podopiecznych przekracza limit",
      "Dodanie łóżek, przyjęcie albo import ponad limit wymaga potwierdzenia po ostrzeżeniu z liczbami; bez potwierdzenia nic nie jest zapisywane",
      "Zatwierdzone przekroczenie zapisuje ORGANIZATION_CAPACITY_EXCEEDED w audit_logs bez danych osobowych",
      "Zatwierdzone przekroczenie wysyła powiadomienia A4 do kierownika placówki i A5 do super admina, bez danych podopiecznych",
      "Lista placówek super admina oznacza placówkę ponad limitem plakietką w tonie brand, nie czerwienią"
    ]
  },
  {
    "id": "ADM-RESIDENT-FUNDING",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-24",
    "domain": "residents",
    "statement": "Kierownik placówki zapisuje źródło finansowania pobytu podopiecznego, oddzielnie od źródła pozyskania.",
    "acceptance": [
      "Źródło finansowania przyjmuje wyłącznie wartości: Prywatnie (podopieczny lub rodzina), Gmina / MOPS, Współfinansowanie (prywatnie + gmina), Inne; inną wartość odrzuca baza",
      "Brak wartości jest pokazywany jako „Brak danych”, nigdy jako wartość domyślna ani zgadywana",
      "Źródło finansowania czyta i zmienia wyłącznie kierownik placówki (sekcja karty „Umowa i pakiety”); pielęgniarka, rodzina i opiekun prawny go nie widzą",
      "Dotychczasowe contract_source jest podpisane w interfejsie jako „Źródło pozyskania”",
      "Migracja nie nadaje wartości istniejącym podopiecznym — pole zostaje puste do uzupełnienia przez kierownika"
    ]
  },
  {
    "id": "ADM-RESIDENT-PHOTO",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-25",
    "domain": "residents",
    "statement": "Zdjęcie podopiecznego jest przechowywane prywatnie i dostępne wyłącznie osobom uprawnionym do danych tego podopiecznego.",
    "acceptance": [
      "Zdjęcia podopiecznych leżą w prywatnym buckecie; bez zalogowania i uprawnienia plik nie jest dostępny pod żadnym adresem",
      "Wgrywa, zmienia i usuwa zdjęcie wyłącznie kierownik placówki, tylko dla podopiecznego swojej placówki; ścieżka pliku zaczyna się od identyfikatora placówki i podopiecznego",
      "Czyta personel placówki podopiecznego oraz bliscy z aktywnym powiązaniem lub w oknie retencji; aplikacja pokazuje zdjęcie przez krótkotrwały podpisany link",
      "Zdjęcie dodaje się i zmienia w oknie „Edytuj” karty podopiecznego oraz w kreatorze przyjęcia, nie w widoku karty",
      "Istniejące zdjęcia z publicznego bucketu są przeniesione, a publiczne kopie usunięte; publiczny bucket nie przyjmuje nowych zdjęć podopiecznych"
    ]
  },
  {
    "id": "ADM-RESIDENT-CARD-VISIBILITY",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-ADM-20",
    "domain": "residents",
    "statement": "Wspólna karta podopiecznego dla personelu pokazuje każdej roli wyłącznie sekcje z zasobów, które ta rola może czytać według macierzy uprawnień.",
    "acceptance": [
      "Lista sekcji karty i ról pochodzi z RESIDENT_CARD_SECTIONS, a nie z komponentu",
      "Pielęgniarka nie widzi bliskich i kontaktów, umowy, pakietów, zdarzeń pobytu ani zarządzania opaską",
      "Karta pobiera jawną listę kolumn dla roli; pesel_hash nie trafia do przeglądarki",
      "Rodzina, opiekun prawny i konto bez roli dostają odmowę przed zapytaniem do bazy",
      "Karta pokazuje wyłącznie metryki behawioralne jako fakty, bez parametrów fizjologicznych"
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
    "id": "UI-TERMINOLOGY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "NFR-UI-06",
    "domain": "presentation",
    "statement": "Ta sama rzecz nazywa się w całym interfejsie tak samo, według słownika UI_TERMINOLOGY.",
    "acceptance": [
      "Teksty widoczne dla użytkownika nie zawierają zakazanych synonimów z UI_TERMINOLOGY (np. ośrodek, Administrator Ośrodka)",
      "Termin formalOnly (pensjonariusz) występuje wyłącznie w dokumentach formalnych z jawnej listy",
      "Nazwy ról w interfejsie pochodzą z ROLES.label, a nie z tekstu wpisanego w komponencie",
      "Tytuły i etykiety pisane są zdaniowo (Struktura placówki, nie Struktura Placówki)"
    ]
  },
  {
    "id": "UI-TEMPLATE-ALIGNMENT",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "NFR-UI-03",
    "domain": "presentation",
    "statement": "Interfejs używa komponentów, układu i wygladu szablonu shadcn-admin (styl nova) — promień, cień, odstępy, jeden styl przycisków i filtrów — z tekstem min. 14px i celem dotykowym 38px (ADR-016, ADR-018), z tokenami generowanymi z kontraktu.",
    "acceptance": [
      "apps/web importuje wygenerowany tokens.css, a zmienne motywu w globals.css wskazują tokeny --sc-* bez wartości kolorów wpisanych ręcznie",
      "Panel administratora i panel personelu mają zwijany pasek boczny szablonu z przyciskiem zwijania w nagłówku strony",
      "Komponenty bazowe szablonu potrzebne widokom (sidebar, table, tabs, select, field, empty, chart) są dostępne w components/ui",
      "Kolory chart-* nie prezentują metryk pensjonariusza — zestawienia trendu pozostają zakazane (ADR-005)",
      "Każdy widok listy obiektów ma przełącznik kafelki/tabela z domyślną tabelą (patterns/ViewToggle); wyjątek: rejestry audytowe (Rejestr Audytowy, Dziennik Audytowy IAM) pozostają wyłącznie tabelą"
    ]
  },
  {
    "id": "VOICE-ZERO-GUESSING",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-02/AC2, SC-NUR-18, SC-NUR-19, ADR-006, ADR-022",
    "domain": "voice",
    "statement": "Model raportowy nigdy nie ustala tożsamości podopiecznego z nagrania.",
    "acceptance": [
      "Tryb nagrania o podopiecznym wymaga resident_id jako UUID z aplikacji i zachowuje wybrany zakres, a sprzeczna wzmianka wymaga wyjaśnienia",
      "Tryb nagrania ogólnego przyjmuje audio bez resident_id, a autor pochodzi z uwierzytelnionej sesji",
      "Serwer ustala zakres fragmentu w rejestrze tej samej placówki przed klasyfikacją, a przypadek niejednoznaczny oczekuje w kolejce",
      "Transkrypt wysyłany do modelu raportowego nie zawiera imienia, nazwiska ani identyfikatora, a system łączy wynik z tożsamością przed zapisem"
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
    "source": "SC-NUR-02/AC3, SC-NUR-02/AC4",
    "domain": "voice",
    "statement": "Surowe nagrania są usuwane po terminie retencji placówki, domyślnie po trzydziestu dniach.",
    "acceptance": [
      "Zadanie bazodanowe usuwa wpisy starsze niż TTL",
      "Usunięcie nie kasuje zatwierdzonego raportu",
      "Placówka bez własnego ustawienia ma retencję 30 dni",
      "Ustawienie spoza zakresu 7–90 dni jest odrzucane",
      "Retencję zmienia wyłącznie kierownik swojej placówki albo super admin",
      "Po terminie znika także plik nagrania w voice-recordings",
      "Zmiana retencji trafia do audit_logs"
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
    "id": "VOICE-DEVICE-INGEST",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-17, ADR-022",
    "domain": "voice",
    "statement": "Urządzenie z ekranem tylko ze stanem (bez treści nagrań i nazwisk) przekazuje nagrania przez uwierzytelniony, idempotentny protokół z potwierdzeniem odbioru i czasem serwera.",
    "acceptance": [
      "Żądanie bez ważnego tokenu albo z tokenem unieważnionym dostaje DEVICE_REVOKED",
      "Token urządzenia jest przechowywany wyłącznie jako skrót token_hash",
      "Ponowna wysyłka tej samej pary device_id i client_capture_id zwraca DUPLICATE bez drugiego wpisu",
      "Urządzenie kasuje nagranie wyłącznie po ACCEPTED albo DUPLICATE",
      "Żądanie z resident_id, imieniem, PESEL albo transkryptem jest odrzucane jako FORBIDDEN_FIELD",
      "Przedstawienie z pierwszego nagrania to deklaracja autora sesji, którą kierownik może skorygować dla wybranego fragmentu",
      "Przedstawienie dopasowuje serwer bez modelu do personelu placówki; brak albo kilka dopasowań wybiera kierownik zmiany",
      "Bezczynność urządzenia powyżej 3 godzin automatycznie otwiera nową sesję, chroniąc prywatność brudnopisów między osobami",
      "Gdy później dotrze session_seq 1, serwer uzupełnia brakującą deklarację autora z zachowaniem ręcznych korekt",
      "Nagranie z czasem spoza okna synchronizacji dostaje oznaczenie TIME_UNCERTAIN",
      "Każda odpowiedź protokołu niesie server_time, z którego urządzenie bez RTC ustawia zegar",
      "Nagranie z clock_state RELATIVE dostaje recorded_at równe chwili przyjęcia INIT minus age_ms",
      "Nagranie z clock_state UNKNOWN dostaje oznaczenie TIME_UNCERTAIN"
    ]
  },
  {
    "id": "VOICE-RESIDENT-ASSIGN",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-NUR-18, SC-NUR-19, ADR-022",
    "domain": "voice",
    "statement": "Serwer przypisuje zakres fragmentu nagrania, a kierownik rozstrzyga wyjątki i może skorygować autora.",
    "acceptance": [
      "Jeden plik może zawierać wiele fragmentów, a każdy fragment ma własny zakres i odnośnik do źródła",
      "Jedno spójne dopasowanie serwera w rejestrze placówki przypisuje podopiecznego na potrzeby szkicu, a jawna sprawa placówki otrzymuje zakres FACILITY",
      "Brak lub konflikt dopasowania, nieustalony autor albo niepewny czas trafiają do kolejki z powodem, bez zatrzymywania poprawnie rozstrzygniętych fragmentów",
      "Kolejkę czyta i rozstrzyga wyłącznie kierownik tej zmiany albo kierownik placówki, a bliscy otrzymują zero wierszy",
      "Fragment nierozstrzygnięty albo oznaczony jako nie do przypisania pozostaje poza klasyfikacją i raportami oraz podlega retencji",
      "Audyt zapisuje metodę, czas i identyfikatory źródła oraz zmiany przypisania z osobą przy ręcznej korekcie, bez treści transkryptu",
      "Automatyczne przypisanie zasila szkic bez zatwierdzania raportu, publikacji rodzinie ani rozliczania zadań"
    ]
  },
  {
    "id": "VOICE-DEVICE-REGISTRY",
    "status": "TODO",
    "risk": "MEDIUM",
    "source": "SC-ADM-24, ADR-022",
    "domain": "voice",
    "statement": "Kierownik placówki prowadzi rejestr urządzeń placówki. Urządzenia są wspólne: przedstawienie określa deklarowanego autora sesji, a wpis wydania jest opcjonalną ewidencją sprzętu.",
    "acceptance": [
      "Token urządzenia jest pokazywany jeden raz przy rejestracji",
      "Unieważnienie ustawia revoked_at zamiast usuwać wiersz",
      "Jedno urządzenie ma w danej chwili najwyżej jeden aktywny wpis wydania",
      "Wpis wydania tworzy kierownik zmiany albo kierownik placówki i nie wyznacza autora nagrań",
      "Rejestracja, unieważnienie i wpis wydania trafiają do audit_logs",
      "Konto bliskiego nie widzi urządzeń ani wpisów wydania"
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
    "id": "VOICE-DOCK-REPORTS",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-SUP-06, SC-NUR-12, ADR-023",
    "domain": "reports",
    "statement": "Potok głosowy w module module_voice_and_reports zapisuje po etapie ASSIGN i REDACT niemutowalne, zanonimizowane zdarzenia (voice_sanitized_events) i kieruje je do konfigurowalnych per placówka kategorii raportów operacyjnych (organization_report_configs, operational_reports) bez ujawniania strumienia MEDICAL ani dopuszczania ról bliskich.",
    "acceptance": [
      "Nagrania z aplikacji wymagają potwierdzonego resident_id przy nagraniu (AT_CAPTURE), a nagrania z urządzeń przechodzą przez voice_assignment_queue (RESIDENT lub FACILITY) przed utworzeniem voice_sanitized_events; do czasu wdrożenia migracji voice_assignment_queue zapisy DEVICE odmawiają w trybie fail-closed",
      "Przed klasyfikacją domenową i generowaniem raportów wycinane są dane medyczne (MEDICAL_CATEGORIES) oraz maskowane są PESEL, telefon, e-mail, imiona, nazwiska, numery pokoi i etykiety łóżek",
      "Każda placówka ma domyślne kategorie operacyjne (audit_operational, technical_maintenance, catering_kitchen), a super_admin może dodawać i archiwizować dodatkowe kategorie per placówka wyłącznie przez RPC z blokadą impersonacji i śladem w audit_logs",
      "Flaga allow_org_admin_report_config deleguje Kierownikowi placówki wyłącznie konfigurację istniejących kategorii własnej placówki (włączenie, harmonogram, dozwolone sekcje, role odbiorców org_admin/nurse, retencja 30–1825 dni z globalnym domyślnym 365 dni), a nie tworzenie kategorii ani zmianę reguł redakcji",
      "Zasoby voice_sanitized_events, organization_report_configs i operational_reports są niedostępne dla ról family i legal_guardian (0 wierszy w RLS); super_admin nie czyta treści voice_sanitized_events ani operational_reports",
      "Zapis voice_sanitized_events oraz generowanych szkiców operational_reports odbywa się wyłącznie z zaufanego potoku serwerowego (service_role po redakcji i post-filtrze MDR, create: [] dla sesji klienckich), natomiast sesje authenticated mają wyłącznie RPC konfiguracji kategorii i zatwierdzania raportu",
      "Trigger niemutowalności voice_sanitized_events blokuje ręczną edycję treści, zezwalając wyłącznie na wyzerowanie draft_note_id (ON DELETE SET NULL) przy retencji voice_draft_notes, kaskadowe usunięcie przy wymazaniu podopiecznego (RODO art. 17) oraz usunięcie po upływie retencji placówki (cleanup_expired_operational_reports, domyślnie 365 dni); wymazanie podopiecznego cofa powiązany raport operacyjny do status = DRAFT (lub no_data: true przy utracie wszystkich źródeł)",
      "Przy braku zdarzeń w okresie raportu generator zwraca jawny komunikat o braku danych bez fabrykowania faktów, a fakty operacyjne/placówkowe nie są wstrzykiwane do raportu rodzinnego daily_reports"
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
    "statement": "Bliski zostawia wiadomość dla kierownika / administratora placówki bez dzwonienia na dyżurkę.",
    "acceptance": [
      "Wiadomości są niezmienialne po wysłaniu",
      "Limit trzech wiadomości na godzinę na konto",
      "Przekroczenie limitu pokazuje czytelny komunikat, nie błąd techniczny",
      "Wysyłka wymaga aktywnego powiązania",
      "Dostęp do odczytu i odpowiedzi po stronie placówki posiada wyłącznie org_admin (brak dostępu dla roli nurse)"
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
    "id": "FAM-AGENDA-NO-MEDICAL",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-FAM-06",
    "domain": "family",
    "statement": "Plan dnia widoczny dla bliskich nie zawiera treści medycznych.",
    "acceptance": [
      "Pozycje typu medication i pozycje, których tytuł zawiera słowo z AGENDA_FAMILY_EXCLUSION, nie są zwracane bliskim przez bazę (RLS), nie tylko ukrywane w interfejsie",
      "Każda kategoria MEDICAL ma słowa na liście; pozycje niemedyczne o podobnym brzmieniu (np. wizyta rodziny) pozostają widoczne",
      "Personel widzi przy wpisie informację, że pozycja z treścią medyczną nie będzie widoczna dla rodziny",
      "Widok rodziny nie ma kategorii leków"
    ]
  },
  {
    "id": "FAM-RESIDENT-DATA-MINIMIZATION",
    "status": "TODO",
    "risk": "HIGH",
    "source": "SC-FAM-08",
    "domain": "family",
    "statement": "Bliscy odczytują dane podopiecznego wyłącznie przez wąskie RPC z jawną listą kolumn, bez dostępu do tabeli residents.",
    "acceptance": [
      "Tabela residents nie ma polityki odczytu dla ról family i legal_guardian; zapytanie bliskiego do residents zwraca zero wierszy, także przez API",
      "Bliski otrzymuje wyłącznie: identyfikator, imię, nazwisko, zdjęcie, datę zgonu, datę końca umowy i datę archiwizacji (get_family_resident_overview); pesel_hash, is_zsn, care_level, notes, dane umowy i ścieżka dokumentu umowy nie mają ścieżki do portalu rodziny",
      "Plan dnia placówki dla bliskich działa bez odczytu residents w kontekście bliskiego",
      "Portal rodziny nie osadza residents w zapytaniach; błąd RPC jest jawnym błędem, nie cichym odczytem tabeli"
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
  },
  {
    "id": "INFRA-GROQ-DEMO-INTERIM",
    "status": "TODO",
    "risk": "HIGH",
    "source": "ADR-015, ADR-021",
    "domain": "infra",
    "statement": "Gdy brak klucza modelu EU, CLASSIFY, GENERATE oraz etapy przekazania zmiany (HANDOVER_STRUCTURE, TASK_PROPOSE) mogą tymczasowo korzystać z Groq wyłącznie w jawnie włączonym trybie demo (ALLOW_DEMO_GROQ_FALLBACK=true), przed podpisaniem DPA, ograniczone do danych syntetycznych.",
    "acceptance": [
      "Sama obecność GROQ_API_KEY nie aktywuje trybu demo — wymagana osobna zmienna ALLOW_DEMO_GROQ_FALLBACK=true",
      "Klucz EU ma pierwszeństwo nad trybem demo, jeśli oba są obecne",
      "Nieprawidłowy EU_LLM_ENDPOINT nadal kończy się błędem [EU-LLM-REGION] niezależnie od trybu demo",
      "Każde użycie trybu demo zostawia ślad w logu serwera bez PII i bez treści promptu",
      "Wpis GROQ_DEMO_LLM w PROVIDERS ma transferMechanism, exceptionApprovedBy i exceptionReason zgodnie z R22",
      "Ta sama ścieżka kodu dla każdej organizacji — dostawca modelu wynika wyłącznie z konfiguracji, bez rozgałęzień „organizacja demo”",
      "Treść MEDICAL z nagrania przekazania może trafić do modelu tylko na etapach HANDOVER_STRUCTURE i TASK_PROPOSE, nigdy na etapie GENERATE raportu dla bliskich"
    ]
  }
] as const;

export type RequirementId = typeof REQUIREMENTS[number]['id'];
