import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const michalId = '6a1e8bee5edd0ea47730152c';
const darekId = '5ce666443ecfaa7f62756e43';

const mediumLabelId = '6aa2a30cfe1edc23075e4d3b'; // MEDIUM (orange)
const lowLabelId = '6aa2a30cb7b7995153e0f627';    // LOW (green)

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const auditTodoCards = [
  {
    num: 16,
    idList: '6aa2a316ec44665e95bbeb48', // Security (SEC)
    labelId: mediumLabelId,
    name: 'Do implementacji jako 16, SEC-API-WRAPPER: Centralny wrapper autoryzacji withAuth dla tras API (eliminacja duplikacji)',
    desc: `### 📖 User Story
**Jako** programista systemu Silver Care,
**Chcę** posiadać standardowy helper \`withAuth(handler, { roles?: Role[] })\` w warstwie API (\`apps/web/src/lib/api-auth.ts\`),
**Aby** wyeliminować powtarzalny kod pobierania użytkownika i sesji w każdym route handlerze oraz zagwarantować spójną autoryzację i ochronę przed nieuprawnionym dostępem (zgodnie z wnioskami audytu #10).

### ⚙️ Wymagania Techniczne & Architektura
- Centralne odczytywanie sesji i nagłówka \`Authorization: Bearer\`.
- Opcjonalny parametr z listą dozwolonych ról (\`org_admin\`, \`nurse\`, \`family\`, \`super_admin\`).
- Zwracanie ujednoliconych statusów 401 Unauthorized i 403 Forbidden.
- Refaktoring tras API w \`apps/web/src/app/api/**\` na nowy mechanizm.

### ✅ Kryteria Akceptacji
- **AC1:** Helper \`withAuth\` poprawnie przekazuje zweryfikowany kontekst użytkownika (\`user\`, \`role\`, \`organizationId\`) do handlera.
- **AC2:** Próba wywołania endpointu bez tokena/sesji zwraca 401 JSON.
- **AC3:** Próba wywołania endpointu przez użytkownika bez wymaganej roli zwraca 403 JSON bez ujawniania danych.`
  },
  {
    num: 17,
    idList: '6aa2a3175176ba725c931e24', // Infra
    labelId: mediumLabelId,
    name: 'Do implementacji jako 17, INFRA-TYPING: Generowanie typów Database Supabase i eliminacja Record<string, unknown>',
    desc: `### 📖 User Story
**Jako** programista aplikacji frontendowej i server actions,
**Chcę** wygenerować ścisłe definicje typów bazy danych Supabase (\`Database\`) i podpiąć je pod klientów bazy danych,
**Aby** wyeliminować podatne na błędy konstrukcje \`Record<string, unknown>\`, zyskać autouzupełnianie kolumn i zagwarantować pełne bezpieczeństwo typów TypeScript (zgodnie z wnioskami audytu #9 i #20).

### ⚙️ Wymagania Techniczne & Architektura
- Skrypt npm \`pnpm db:types\` generujący definicje typów z lokalnej bazy lub schematu SQL do pliku \`apps/web/src/types/database.types.ts\`.
- Otypowanie klientów Supabase: \`createClient<Database>()\`.
- Zastąpienie typowania w komponentach zarządczych (np. \`StaffBoardClient\`, \`IamManagementClient\`).

### ✅ Kryteria Akceptacji
- **AC1:** Istnieje polecenie generowania aktualnych typów bazy danych.
- **AC2:** Klient Supabase w aplikacji webowej wymusza poprawne nazwy tabel i kolumn w zapytaniach.
- **AC3:** Kompilacja \`pnpm --filter web build\` oraz testy jednostkowe przechodzą na 100%.`
  },
  {
    num: 18,
    idList: '6aa2a30d5410b68e5cd67f30', // Residents (ADM)
    labelId: mediumLabelId,
    name: 'Do implementacji jako 18, ADM-PAGINATION: Paginacja serwerowa w widokach i endpointach (IAM, Pensjonariusze, Rejestr Audytowy)',
    desc: `### 📖 User Story
**Jako** administrator placówki oraz personel opiekuńczy,
**Chcę**, aby listy pensjonariuszy, kont personelu i historia audytu pobierały się stronami (paginacja serwerowa),
**Aby** interfejs ładował się natychmiast, a transfer sieciowy i zużycie pamięci nie rosły drastycznie wraz ze wzrostem liczby podopiecznych w placówce (zgodnie z wnioskami audytu #17 i #18).

### ⚙️ Wymagania Techniczne & Architektura
- Endpointy i server actions przyjmują parametry \`page\` i \`pageSize\` (lub \`limit\` i \`offset\`).
- Zapytania do bazy danych używają klauzul \`LIMIT\` i \`OFFSET\` oraz zwracają całkowitą liczbę rekordów (\`count\`).
- Komponenty UI zawierają kontrolki przełączania stron (Następna, Poprzednia, Skocz do strony).

### ✅ Kryteria Akceptacji
- **AC1:** Lista pensjonariuszy ładuje domyślnie określoną liczbę pozycji (np. 20 lub 50).
- **AC2:** Zmiana strony ładuje kolejną porcję danych bez przeładowania całej aplikacji.
- **AC3:** Rejestr audytowy (\`/admin/audit\`) nie pobiera jednorazowo tysięcy rekordów do przeglądarki.`
  },
  {
    num: 19,
    idList: '6aa2a3135ec81511fdaddb5c', // Presentation (MDR/UI)
    labelId: lowLabelId,
    name: 'Do implementacji jako 19, UI-REFACTOR-MONOLITH: Dekonstrukcja monolitycznych komponentów React (IamManagementClient, StaffBoardClient)',
    desc: `### 📖 User Story
**Jako** programista interfejsu użytkownika,
**Chcę** podzielić monolityczny komponent \`IamManagementClient.tsx\` (>700 linii) oraz \`StaffBoardClient.tsx\` na mniejsze, wyspecjalizowane subkomponenty i scentralizować stan za pomocą \`useReducer\`,
**Aby** kod był modularny, łatwy w utrzymaniu, prosty w testowaniu i nie powodował zbędnych re-renderów całego widoku (zgodnie z wnioskami audytu #8).

### ⚙️ Wymagania Techniczne & Architektura
- Wydzielenie podkomponentów: \`UserTable\`, \`AuditLogTable\`, \`AddUserModal\`, \`ResetPasswordModal\`.
- Zastąpienie 12 pojedynczych stanów \`useState\` jednym czytelnym reducerem stanu dialogów i formularzy.
- Zachowanie 100% dotychczasowego wyglądu, responsywności i działania.

### ✅ Kryteria Akceptacji
- **AC1:** Główny komponent zarządczy mieści się w granicach 150-250 linii czytelnego JSX.
- **AC2:** Wszystkie akcje (dodawanie pracownika, reset hasła, dezaktywacja) działają identycznie jak dotychczas.
- **AC3:** Kompilacja produkcyjna i testy UI przechodzą bez ostrzeżeń.`
  },
  {
    num: 20,
    idList: '6aa2a316ec44665e95bbeb48', // Security (SEC)
    labelId: mediumLabelId,
    name: 'Do implementacji jako 20, SEC-API-ERRORS: Standaryzacja i bezpieczna obsługa błędów w API Routes (eliminacja error: any i wycieków)',
    desc: `### 📖 User Story
**Jako** inżynier bezpieczeństwa i użytkownik systemu,
**Chcę**, aby wszystkie endpointy API obsługiwały błędy w standaryzowany i bezpieczny sposób,
**Aby** do odpowiedzi HTTP nie wyciekały wewnętrzne komunikaty bazy danych, nazwy tabel, błędy SQL czy ścieżki plików serwera, a klient otrzymywał czytelne, bezpieczne komunikaty (zgodnie z wnioskami audytu #19).

### ⚙️ Wymagania Techniczne & Architektura
- Usunięcie \`catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }) }\`.
- Wprowadzenie centralnego handlera błędów \`handleApiError(error)\` generującego identyfikator incydentu (\`error_id\`).
- Szczegółowe logowanie błędu wyłącznie po stronie serwera (z zachowaniem reguły SEC-NO-PII).

### ✅ Kryteria Akceptacji
- **AC1:** Odpowiedzi 500 zawierają ogólny, bezpieczny komunikat i kod błędu (np. \`{ error: "Wystąpił błąd serwera", code: "INTERNAL_ERROR" }\`).
- **AC2:** Żaden endpoint API nie ujawnia surowych wyjątków Postgresa ani stack trace.
- **AC3:** Bramka testowa potwierdza brak regresji w istniejących trasach.`
  },
  {
    num: 21,
    idList: '6aa2a3175176ba725c931e24', // Infra
    labelId: lowLabelId,
    name: 'Do implementacji jako 21, INFRA-ENV-SPEC: Utworzenie i weryfikacja .env.example z pełną specyfikacją zmiennych środowiskowych',
    desc: `### 📖 User Story
**Jako** inżynier DevOps i nowy członek zespołu deweloperskiego,
**Chcę** posiadać kompletny i zaktualizowany plik \`.env.example\` w repozytorium,
**Aby** móc skonfigurować lokalne środowisko uruchomieniowe bez zgadywania i analizowania kodu źródłowego (zgodnie z wnioskami audytu #21).

### ⚙️ Wymagania Techniczne & Architektura
- Utworzenie plików \`.env.example\` w katalogu głównym oraz w \`apps/web/.env.example\`.
- Opisanie zmiennych: \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`DATABASE_URL\`, \`PESEL_HASH_SALT\`, \`POLAR_CLIENT_ID\`, \`POLAR_CLIENT_SECRET\`, \`GROQ_API_KEY\`, \`TRELLO_*\`.
- Zapewnienie, że w szablonie nie ma żadnych prawdziwych kluczy ani danych wrażliwych.

### ✅ Kryteria Akceptacji
- **AC1:** Plik \`.env.example\` zawiera komplet zmiennych wymaganych do uruchomienia aplikacji i testów.
- **AC2:** Każda zmienna posiada krótki komentarz opisujący jej rolę i format.`
  },
  {
    num: 22,
    idList: '6aa2a3135ec81511fdaddb5c', // Presentation (MDR/UI)
    labelId: lowLabelId,
    name: 'Do implementacji jako 22, ADM-JSONB-SCHEMA: Walidacja i schematyzacja pola daily_logs.data w bazie danych',
    desc: `### 📖 User Story
**Jako** administrator danych placówki opiekuńczej,
**Chcę**, aby dane dzienne podopiecznych zapisywane w kolumnie \`daily_logs.data\` podlegały ścisłej walidacji strukturalnej,
**Aby** zagwarantować integralność wpisów, zapobiec uszkodzeniom generowanych przez sztuczną inteligencję oraz ułatwić przyszłą analitykę i raportowanie (zgodnie z wnioskami audytu #24).

### ⚙️ Wymagania Techniczne & Architektura
- Zdefiniowanie schematu JSON (lub Zod schema w serwisie logów dziennych) z wymaganymi polami raportu opiekuńczego.
- Migracja SQL dodająca regułę \`CHECK (jsonb_typeof(data) = 'object')\` lub weryfikację struktury.
- Test jednostkowy sprawdzający odrzucenie zapisu niepoprawnego formatu.

### ✅ Kryteria Akceptacji
- **AC1:** Kolumna \`daily_logs.data\` przyjmuje wyłącznie poprawne obiekty JSON.
- **AC2:** Niepoprawne formaty danych są natychmiast wyłapywane i logowane z błędem walidacji.`
  }
];

async function run() {
  console.log(`Tworzenie ${auditTodoCards.length} nowych kart TO DO na Trello...`);

  for (const card of auditTodoCards) {
    const res = await fetch('https://api.trello.com/1/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: apiKey,
        token: token,
        idList: card.idList,
        name: card.name,
        desc: card.desc,
        idMembers: [michalId, darekId],
        idLabels: [card.labelId],
        pos: 'bottom'
      })
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Utworzono kartę #${card.num}: [${data.id}] "${card.name}"`);
    } else {
      console.error(`✗ Błąd tworzenia karty #${card.num}:`, await res.text());
    }
  }

  // Zaktualizuj kartę zbiorczą audytu informacją o dekompozycji zadań
  const auditCardId = '6aae3a02fb4d067bd09dc757';
  const progressComment = `📌 **Status Audytu Technicznego:**
Wszystkie krytyczne podatności bezpieczeństwa i błędy integracyjne (Routing, Middleware, Hasła CSPRNG, Audit Logs R14, Rate Limiting, Placeholder fallbacki, Indeksy RLS) zostały pomyślnie zaimplementowane i przetestowane w commit \`16b9cea\`.

Pozostałe zadania z audytu (dotyczące optymalizacji architektury, typowania bazy danych, paginacji, refaktoryzacji komponentów i standaryzacji API) zostały rozpisane na 7 konkretnych kart zadań TO DO w domenach Trello:
- **Karta 16**: SEC-API-WRAPPER (Security)
- **Karta 17**: INFRA-TYPING (Infra)
- **Karta 18**: ADM-PAGINATION (Residents)
- **Karta 19**: UI-REFACTOR-MONOLITH (Presentation)
- **Karta 20**: SEC-API-ERRORS (Security)
- **Karta 21**: INFRA-ENV-SPEC (Infra)
- **Karta 22**: ADM-JSONB-SCHEMA (Presentation)`;

  await fetch(`https://api.trello.com/1/cards/${auditCardId}/actions/comments?key=${apiKey}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: progressComment })
  });

  console.log('\n✅ Sukces: Wszystkie zadania TO DO zostały dodane do Trello i powiązane z audytem!');
}

run().catch(console.error);
