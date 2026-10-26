/**
 * sc.config.mjs — konfiguracja bramki Silver Care.
 *
 * Wzorce zakazane w kodzie. Każdy wynika z rozstrzygniętego ADR, a nie z gustu.
 * Reguła bez uzasadnienia w kontrakcie nie ma tu czego szukać.
 */
export const config = {
  contractsDir: 'contracts',
  generatedTsDir: 'packages/contracts/src/generated',
  // Używane przez .claude/hooks/guard-paths.mjs do odczytu stanu okna kontraktowego.
  // Ta sama ścieżka co w tools/sc-contract-window.mjs — brak tego klucza sprawiał, że
  // hook czytał "${PROJECT}/undefined/contract-window.json" i zawsze widział okno zamknięte.
  stateDir: '.claude/state',

  contractProtectedPaths: ['contracts/', 'packages/contracts/src/generated/', 'packages/database/schema.prisma'],
  testPathPatterns: ['/tests/', '.test.', '.spec.', 'e2e/'],


  forbiddenPatterns: [
    // ── ADR-005: granica MDR w warstwie prezentacji ────────────────────────
    {
      id: 'adr005-physio-leak',
      re: '\\b(heart_rate_bpm|resting_heart_rate_bpm|min_heart_rate_bpm|max_heart_rate_bpm|avg_heart_rate_bpm|hrv_ms|breathing_rate|ans_charge|recovery_score|sleep_score|nightly_recharge_status)\\b',
      appliesTo: 'apps/family/.*\\.(ts|tsx)$|packages/.*family.*\\.(ts|tsx)$',
      msg: 'ADR-005: parametr fizjologiczny w warstwie rodziny. Wariant B dopuszcza wyłącznie metryki behawioralne z FAMILY_VISIBLE_METRICS — kroki, długość snu, czas aktywności. Zestawienie tętna lub HRV w celu oceny kondycji wprowadza produkt w zakres wyrobu medycznego.',
    },
    {
      id: 'adr005-metric-alarm',
      re: '(alert|alarm|notify|sendPush|push)\\s*\\([^)]*\\b(steps|heart_rate|hrv|sleep_score|activity)\\b|\\b(steps|heartRate|hrv)\\w*\\s*[<>]=?\\s*\\d+\\s*\\)?\\s*(&&|\\|\\||\\?|\\{)?\\s*(notify|alert|sendNotification)',
      appliesTo: '\\.(ts|tsx)$',
      allowIn: ['contracts/', 'packages/contracts/'],
      msg: 'ADR-005: powiadomienie wyzwalane metryką. Jedynym wyzwalaczem jest publikacja raportu — aplikacja jest cicha wobec danych z urządzenia.',
    },
    {
      id: 'adr005-clinical-language',
      re: '(podejrzenie|diagnoz|prawdopodobnie choruje|objaw[yu]?\\s|stan zdrowia pogarsza|wskazuje na chorob)',
      appliesTo: 'apps/.*\\.(ts|tsx)$|supabase/functions/.*\\.(ts|js)$|prompts?/.*\\.(md|txt|ts)$',
      allowIn: ['docs/', 'contracts/', '/tests/', '.test.'],
      msg: 'ADR-005: język kliniczny w treści dla użytkownika. System opisuje fakty o zachowaniu, nie ocenia stanu zdrowia.',
    },

    // ── ADR-004: zakazane słownictwo ───────────────────────────────────────
    {
      id: 'adr004-patient-term',
      // [tc] obsługuje polską odmianę: pacjent, pacjenta, ale też „o pacjencie" —
      // miejscownik zmienia temat z t na c, więc sam wzorzec „pacjent" go nie łapie.
      re: '\\b([Pp]acjen[tc]\\w*)\\b',
      appliesTo: 'apps/.*\\.(ts|tsx|md)$|.*\\.(json|yaml)$',
      allowIn: ['docs/', 'contracts/', 'NAMING.md', '/tests/', '.test.'],
      msg: 'ADR-004: słowo „pacjent" jest zakazane w warstwie widocznej dla użytkownika. Używaj: podopieczny, senior, pensjonariusz. Identyfikatory techniczne w bazie mogą pozostać angielskie.',
    },
    {
      id: 'adr004-patient-identifier',
      re: '\\bpatients\\b|\\bcare_homes\\b',
      appliesTo: 'apps/.*\\.(ts|tsx)$|packages/.*\\.(ts|tsx)$|supabase/.*\\.(sql|ts)$',
      allowIn: ['contracts/', 'docs/', 'external', 'integration', '/tests/', '.test.'],
      msg: 'ADR-002/ADR-004: rdzeń nazywa się residents i organizations. Nazwy patients i care_homes żyją wyłącznie w warstwie integracyjnej jako identyfikatory zewnętrzne.',
    },

    // ── ADR-006/ADR-007: potok głosowy ─────────────────────────────────────
    {
      id: 'adr006-identity-guess',
      re: '(identify|match|resolve|guess|infer)\\w*\\s*\\(\\s*[^)]*(transcript|transcription|audio|recording)',
      appliesTo: '\\.(ts|tsx)$',
      allowIn: ['contracts/', 'docs/', '/tests/', '.test.'],
      msg: 'ADR-006: ustalanie tożsamości pensjonariusza z nagrania. Frontend musi przekazać resident_id jako UUID; model nigdy nie zgaduje, kogo dotyczy notatka.',
    },
    {
      id: 'adr007-raw-transcript-to-llm',
      re: '(messages|prompt|content)\\s*:\\s*[^\\n]*\\braw_?[Tt]ranscript\\b|\\bsendToLLM\\s*\\(\\s*rawTranscript',
      appliesTo: '\\.(ts|tsx)$',
      allowIn: ['contracts/', 'docs/', '/tests/', '.test.'],
      msg: 'ADR-007: surowy transkrypt wysyłany do modelu. Dane medyczne muszą zostać usunięte na etapie REDACT, zanim treść trafi do LLM.',
    },

    // ── ADR-008: brak danych osobowych w logach ────────────────────────────
    {
      id: 'adr008-pii-logging',
      // Negatywne spojrzenie w przód przepuszcza residentId i resident_id — logowanie
      // samego UUID jest wprost zalecane przez NFR-SEC-01/AC2. Blokujemy residentData,
      // residentProfile i inne nośniki treści.
      re: 'console\\.(log|info|warn|error|debug)\\s*\\([^)]*\\b(resident|patient|pesel|firstName|lastName|full_name|transcript|note|report|email|phone)(?!_?[Ii][Dd]s?\\b)\\w*\\b',
      appliesTo: '\\.(ts|tsx)$',
      allowIn: ['/tests/', '.test.', 'docs/'],
      msg: 'ADR-008 / NFR-SEC-01: logowanie danych osobowych lub zdrowotnych. Loguj wyłącznie identyfikatory UUID i kody techniczne.',
    },
    {
      id: 'adr008-pesel-plaintext',
      re: '\\bpesel\\b(?!_hash)',
      appliesTo: 'apps/.*\\.(ts|tsx)$|packages/.*\\.(ts|tsx)$|supabase/.*\\.(sql|ts)$',
      allowIn: ['contracts/', 'docs/', '/tests/', '.test.'],
      msg: 'SEC-PESEL-HASH: PESEL wolno przechowywać i przetwarzać wyłącznie jako pesel_hash.',
    },

    // ── ADR-003: zgody ─────────────────────────────────────────────────────
    {
      id: 'adr003-consent-mutate',
      re: '(consentLedger|consent_ledger)\\s*\\.\\s*(update|updateMany|delete|deleteMany|upsert)\\b|(UPDATE|DELETE)\\s+(FROM\\s+)?consent_ledger\\b',
      appliesTo: '\\.(ts|tsx|sql)$',
      msg: 'ADR-003: rejestr zgód jest niezmienialny. Cofnięcie zgody to zapis revoked_at przez nowy stan, nie edycja historii.',
    },
    {
      id: 'adr003-audit-mutate',
      re: '(auditLogs?|audit_logs)\\s*\\.\\s*(update|updateMany|delete|deleteMany|upsert)\\b|(UPDATE|DELETE)\\s+(FROM\\s+)?audit_logs\\b',
      appliesTo: '\\.(ts|tsx|sql)$',
      allowIn: ['retention'],
      msg: 'SEC-AUDIT-APPEND-ONLY: rejestr audytowy jest append-only. Jedyny wyjątek to zadanie retencyjne po stronie bazy.',
    },

    // ── ADR-012: rejestr pokoi i łóżek ──────────────────────────────────────
    {
      id: 'adr012-bed-count-write',
      re: '(rooms?|bed)\\s*\\.\\s*(update|updateMany)\\s*\\([^)]*bed_count',
      appliesTo: 'apps/.*\\.(ts|tsx)$',
      allowIn: ['/tests/', '.test.'],
      msg: 'ADR-012: bed_count jest polem pochodnym wyliczanym z bed_assignments. Ręczny zapis rozjeżdża liczbę z rzeczywistymi przypisaniami.',
    },
    {
      id: 'adr012-assignment-without-close',
      re: 'bedAssignments?\\s*\\.\\s*create\\s*\\(',
      appliesTo: 'apps/.*/(actions|api)/.*\\.(ts|tsx)$',
      allowIn: ['transferResident', 'admitResident', '/tests/', '.test.'],
      msg: 'ADR-012: nowe przypisanie łóżka poza funkcją przenoszącą/przyjmującą. Otwarcie przypisania bez zamknięcia poprzedniego łamie regułę jeden-do-jednego — użyj transferResident, która robi obie operacje w jednej transakcji.',
    },

    // ── ogólne standardy inżynierskie ──────────────────────────────────────
    { id: 'ts-escape-hatch', re: '@ts-ignore|@ts-nocheck|\\bas\\s+any\\b', appliesTo: '\\.(ts|tsx)$', allowIn: ['/tests/', '.test.'], msg: 'Obejście typów przy danych art. 9. Popraw typ zamiast go wyciszać.' },
    { id: 'skipped-test', re: '\\b(it|test|describe)\\.(skip|only)\\b', appliesTo: '\\.(ts|tsx)$', msg: 'Test pominięty albo wyizolowany. Bramka pominięta nie liczy się jako zaliczona.' },
    { id: 'service-role-in-client', re: 'SUPABASE_SERVICE_ROLE_KEY|service_role', appliesTo: 'apps/.*/(components|app)/.*\\.(ts|tsx)$', allowIn: ['supabase/functions/', '/lib/server/', 'route.ts'], msg: 'Klucz service_role omija RLS. W warstwie klienta oznacza wyciek dostępu do wszystkich placówek.' },
    { id: 'hardcoded-secret', re: '(api[_-]?key|secret|token)\\s*[:=]\\s*[\'"][A-Za-z0-9_\\-]{16,}[\'"]', appliesTo: '\\.(ts|tsx|js|mjs)$', allowIn: ['/tests/', '.test.', 'example'], msg: 'Sekret w kodzie. Używaj menedżera sekretów — to typowy błąd narzędzi agentowych.' },
    { id: 'hex-color', re: '#[0-9a-fA-F]{6}\\b', appliesTo: 'apps/.*/(components|app)/.*\\.(tsx)$', allowIn: ['tailwind.config', 'globals.css', 'tokens'], msg: 'NFR-UI-01: kolor zaszyty w komponencie. Używaj tokenów design systemu „Ciepłe Zaufanie".' },
    // ADR-017 pkt 4: kolor wyłącznie z tokenów kontraktu; surowa paleta Tailwind omija kontrakt i może nieść ocenę
    { id: 'ui-raw-palette', re: '\\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|accent|caret|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|[1-9]00|950))?(?:\\/\\d+)?\\b', appliesTo: 'apps/.*/(components|app|lib)/.*\\.(tsx|ts)$', allowIn: ['globals.css', 'tokens'], msg: 'ADR-017: surowa paleta Tailwind (np. bg-amber-500). Używaj tokenów kontraktu: primary, muted, foreground, destructive (wyłącznie błąd techniczny).' },
    // SUP-IAM-PANEL / ORG-ISOLATION: rola i placówka wyłącznie z app_metadata — user_metadata użytkownik edytuje sam
    { id: 'auth-role-from-user-metadata', re: 'user_metadata\\??\\.(?:role|organization_id)\\b', appliesTo: 'apps/.*\\.(tsx|ts)$', msg: 'Rola i placówka wyłącznie z app_metadata (getAppRole / getAppOrganizationId z lib/auth/app-role). user_metadata użytkownik edytuje sam — odczyt roli stamtąd to eskalacja uprawnień.' },
    // ADR-020: skala szablonu — text-xs (12px) dozwolony, mniejsze rozmiary zabronione
    { id: 'ui-micro-font', re: '\\btext-\\[(?:[0-9]|1[01])(?:\\.\\d+)?px\\]', appliesTo: 'apps/.*/(components|app|lib)/.*\\.(tsx|ts)$', allowIn: ['globals.css', 'tokens'], msg: 'ADR-020: tekst poniżej 12px. Najmniejszy dopuszczalny rozmiar to text-xs (12px).' },
    // ADR-018: cel dotykowy wyłącznie z tokenu kontraktu (min-h-touch / min-w-touch), nigdy liczba wpisana na sztywno
    { id: 'ui-touch-target-token', re: '\\bmin-[hw]-(?:1[0-2]|\\[(?:3[0-9]|4[0-9]|5[0-6])px\\])(?![\\w-])', appliesTo: 'apps/.*/(components|app|lib)/.*\\.(tsx|ts)$', allowIn: ['globals.css', 'tokens'], msg: 'ADR-018: cel dotykowy wpisany na sztywno. Użyj min-h-touch / min-w-touch (token z contracts/design.contract.mjs).' },
  ],

  forbiddenBashPatterns: [
    { re: 'supabase\\s+db\\s+reset', msg: 'Reset bazy skasowałby dane pensjonariuszy i ślad audytowy.' },
    { re: 'prisma\\s+migrate\\s+reset', msg: 'Reset migracji kasuje dane. Użyj migracji przyrostowej.' },
    { re: 'git\\s+push\\s+(-f|--force)', msg: 'Wymuszony push nadpisuje historię. Decyzja należy do człowieka.' },
    { re: 'DROP\\s+(TABLE|SCHEMA|DATABASE)', msg: 'Operacja destrukcyjna na schemacie.' },
    { re: 'TRUNCATE\\s+', msg: 'Czyszczenie tabeli z danymi art. 9.' },
    { re: 'rm\\s+-rf\\s+/(?!tmp)', msg: 'Usuwanie poza katalogiem tymczasowym.' },
    { re: 'vercel\\s+(deploy|--prod)', msg: 'Wdrożenie należy do człowieka.' },
  ],
};
