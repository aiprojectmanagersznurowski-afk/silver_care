// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const DECISION_CLASSES = [
  {
    "id": "AUTO",
    "mode": "DECIDE_AND_CONTINUE",
    "desc": "Decyzja techniczna, odwracalna, bez wpływu na dane osobowe i granice prawne.",
    "examples": [
      "Nazwa zmiennej, struktura katalogów, kolejność pól w formularzu.",
      "Wybór biblioteki pomocniczej spośród już obecnych w projekcie.",
      "Sposób obsługi błędu technicznego, format komunikatu deweloperskiego.",
      "Podział komponentu na mniejsze, refaktoryzacja bez zmiany zachowania.",
      "Treść mikrokopii interfejsu zgodna z zakazanym słownictwem."
    ],
    "action": "Wybierz opcję rekomendowaną, odnotuj w podsumowaniu jednym zdaniem, kontynuuj."
  },
  {
    "id": "AUTO_LOGGED",
    "mode": "DECIDE_AND_RECORD",
    "desc": "Decyzja projektowa o trwałych skutkach, ale odwracalna i mieszcząca się w kontrakcie.",
    "examples": [
      "Kształt schematu tabeli pomocniczej nieobjętej kontraktem.",
      "Strategia buforowania, indeksy bazodanowe, sposób paginacji.",
      "Wybór między dwoma poprawnymi sposobami spełnienia kryterium akceptacji.",
      "Struktura promptu w granicach MDR_GUARDRAILS."
    ],
    "action": "Wybierz opcję rekomendowaną, zapisz decyzję i alternatywę w docs/decisions/AUTO-<data>.md, kontynuuj."
  },
  {
    "id": "ESCALATE",
    "mode": "STOP_AND_ASK",
    "desc": "Decyzja nieodwracalna, wiążąca prawnie albo zmieniająca granice bezpieczeństwa.",
    "examples": [
      "Cokolwiek, co zmienia zakres danych widocznych dla bliskich.",
      "Klasyfikacja nowej kategorii danych jako medyczna albo behawioralna.",
      "Nowy dostawca zewnętrzny albo zmiana lokalizacji przetwarzania.",
      "Zmiana podstawy prawnej przetwarzania, zakresu zgody albo ról.",
      "Rozluźnienie reguły bramki, żeby przepuścić implementację."
    ],
    "action": "Zatrzymaj się, przedstaw opcje z rekomendacją i uzasadnieniem, zakończ turę."
  }
] as const;

export const ESCALATION_TRIGGERS = [
  {
    "id": "contract_change",
    "desc": "Zmiana w contracts/ — dowolna.",
    "reason": "Kontrakt jest źródłem prawdy; zmiana wymaga okna kontraktowego otwartego przez człowieka."
  },
  {
    "id": "mdr_boundary",
    "desc": "Zmiana zakresu danych widocznych bliskim albo klasyfikacji pola jako behawioralne/fizjologiczne.",
    "reason": "Decyduje o klasyfikacji produktu jako wyrobu medycznego. Nieodwracalna reputacyjnie i prawnie."
  },
  {
    "id": "medical_category",
    "desc": "Uznanie nowego rodzaju treści za medyczny albo niemedyczny.",
    "reason": "Błąd w jedną stronę wysyła dane o zdrowiu do rodziny, w drugą — okalecza raport."
  },
  {
    "id": "consent_or_legal",
    "desc": "Podstawa prawna, zakres zgody, role opiekuna prawnego i rodziny.",
    "reason": "Wiąże prawnie. Wymaga ustaleń z prawnikiem, nie wyboru technicznego."
  },
  {
    "id": "external_provider",
    "desc": "Nowy dostawca zewnętrzny, nowy transfer danych, zmiana regionu.",
    "reason": "Każdy transfer poza EOG wymaga udokumentowanego wyjątku — patrz ADR-009."
  },
  {
    "id": "gate_relaxation",
    "desc": "Wyłączenie, złagodzenie albo obejście reguły bramki.",
    "reason": "Reguła blokująca sensowny kod to sygnał do rozmowy, nie do usunięcia reguły."
  },
  {
    "id": "irreversible_data_op",
    "desc": "Migracja kasująca dane, zmiana retencji, twarde usunięcie.",
    "reason": "Nieodwracalne z definicji."
  },
  {
    "id": "production_deploy",
    "desc": "Wdrożenie, commit, merge, publikacja raportu do bliskich.",
    "reason": "Wyjście poza maszynę lokalną należy do człowieka."
  },
  {
    "id": "source_contradiction",
    "desc": "Dokumenty źródłowe mówią sprzeczne rzeczy o tym samym elemencie.",
    "reason": "Zgadywanie przy sprzeczności kosztuje więcej niż zapytanie. To był powód powstania dziewięciu ADR."
  }
] as const;

export const DEFAULTS = [
  {
    "id": "error_handling",
    "choice": "Fail closed",
    "rationale": "Przy danych art. 9 błąd oznacza brak dostępu, nigdy dostęp domyślny."
  },
  {
    "id": "empty_state",
    "choice": "Stan pusty z informacją, kiedy pojawią się dane",
    "rationale": "Biała plama wygląda jak awaria. NFR-UI-01 wymaga czterech stanów."
  },
  {
    "id": "missing_data_display",
    "choice": "Pomiń sekcję zamiast pokazywać zero",
    "rationale": "Zero kroków wygląda jak brak ruchu, a oznacza brak synchronizacji."
  },
  {
    "id": "text_language",
    "choice": "Polski dla użytkownika, angielski dla identyfikatorów",
    "rationale": "ADR-002 i ADR-004."
  },
  {
    "id": "date_format",
    "choice": "Format polski, pełna nazwa miesiąca w raporcie",
    "rationale": "Odbiorcą jest często osoba starsza; „14 sierpnia\" czyta się lepiej niż „14.08\"."
  },
  {
    "id": "timezone",
    "choice": "Europe/Warsaw",
    "rationale": "Jedna strefa dla placówek w Polsce; przeliczanie w jednym miejscu."
  },
  {
    "id": "pagination",
    "choice": "Kursor, nie offset",
    "rationale": "Stabilny przy dopisywaniu wierszy."
  },
  {
    "id": "id_type",
    "choice": "UUID v7",
    "rationale": "Sortowalny po czasie, bez ujawniania liczby rekordów."
  },
  {
    "id": "test_style",
    "choice": "Testowanie zachowania na granicy uprawnień",
    "rationale": "Najważniejsze testy sprawdzają, czego NIE da się zrobić."
  },
  {
    "id": "component_split",
    "choice": "Serwerowy komponent domyślnie, kliencki tylko gdy potrzebna interaktywność",
    "rationale": "Mniej kodu w przeglądarce to mniej powierzchni na wyciek."
  },
  {
    "id": "loading_strategy",
    "choice": "Szkielet interfejsu, nie spinner",
    "rationale": "Szkielet komunikuje kształt treści i mniej niepokoi."
  },
  {
    "id": "ambiguous_copy",
    "choice": "Krótsze i konkretniejsze sformułowanie",
    "rationale": "Odbiorca bywa zmęczony albo zaniepokojony."
  },
  {
    "id": "library_choice",
    "choice": "Biblioteka już obecna w projekcie",
    "rationale": "Każda nowa zależność to nowy podprocesor do przejrzenia."
  },
  {
    "id": "migration_strategy",
    "choice": "Migracja przyrostowa, nigdy reset",
    "rationale": "Reset kasuje dane pensjonariuszy i ślad audytowy."
  }
] as const;

export const RETRY_POLICY = {
  "maxAttemptsPerProblem": 3,
  "onExhausted": "ESCALATE",
  "rationale": "Trzecia nieudana próba tego samego podejścia oznacza, że problem jest gdzie indziej. Dalsze kręcenie się w kółko spala czas i kontekst."
} as const;

export const SESSION_REPORT_SECTIONS = [
  {
    "id": "completed",
    "desc": "Co zostało ukończone, z identyfikatorami wymagań."
  },
  {
    "id": "auto_decisions",
    "desc": "Decyzje podjęte samodzielnie w klasie AUTO_LOGGED, z alternatywami."
  },
  {
    "id": "blocked",
    "desc": "Co zostało zablokowane i dlaczego."
  },
  {
    "id": "requires_decision",
    "desc": "Pytania klasy ESCALATE — zebrane w jednym miejscu, z rekomendacją dla każdego."
  },
  {
    "id": "gate_status",
    "desc": "Wynik bramki, z jawnym wskazaniem etapów pominiętych."
  }
] as const;

