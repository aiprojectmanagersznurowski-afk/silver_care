import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const newCards = [
  {
    num: 3,
    idList: '6aa2a30fc2cc260f25866873', // Staff (NUR)
    name: 'Do implementacji jako 3, Opcja zarządzania swoim kontem (Self-Service Profile & Security)',
    desc: `### 📖 User Story
**Jako** zalogowany użytkownik systemu (pracownik personelu, administrator placówki lub bliski),
**Chcę** mieć dedykowaną stronę zarządzania własnym profilem i bezpieczeństwem konta,
**Aby** samodzielnie zmienić hasło, zweryfikować dane kontaktowe, włączyć/wyłączyć MFA i kontrolować aktywne sesje bez angażowania wsparcia technicznego.

### ⚙️ Wymagania Techniczne & Architektura
- Trasa \`/settings/profile\` dostępna dla zalogowanych użytkowników z podglądem uprawnień (\`app_metadata.role\`).
- Formularz zmiany hasła: wymóg podania bieżącego hasła (\`current_password\`) i nowego (min. 8 znaków, wielka litera, cyfra, znak specjalny).
- Wylogowanie z pozostałych urządzeń via \`supabase.auth.signOut({ scope: 'others' })\`.
- Obsługa MFA (TOTP) dla ról personelu i zarządców placówki.

### ✅ Kryteria Akceptacji
- **AC1:** Po kliknięciu w profil użytkownik przechodzi do \`/settings/profile\`.
- **AC2:** Błędne bieżące hasło natychmiast blokuje procedurę zmiany.
- **AC3:** Pomyślna zmiana rejestruje wpis w \`security_access_logs\` (\`action: password_self_change\`).`
  },
  {
    num: 4,
    idList: '6aa2a30fc2cc260f25866873', // Staff (NUR)
    name: 'Do implementacji jako 4, Zarządzanie kontami personelu przez Admina Placówki (Reset hasła, Deaktywacja, Audyt)',
    desc: `### 📖 User Story
**Jako** Administrator Placówki (\`org_admin\`),
**Chcę** mieć w panelu personelu (\`/admin/staff\`) bezpieczną możliwość wysłania linku resetującego hasło, wygenerowania hasła tymczasowego oraz odwracalnej dezaktywacji/usuwania konta pracownika z potwierdzeniem modalnym,
**Aby** sprawnie zarządzać rotacją personelu w mojej placówce bez eskalacji do \`super_admin\`.

### ⚙️ Wymagania Techniczne & Architektura
- Multi-tenant Guard: \`targetUser.organization_id === sessionUser.organization_id\`.
- Reset hasła: opcja wysłania e-maila z linkiem recovery lub wygenerowania hasła tymczasowego (\`must_change_password: true\`).
- Odwracalna dezaktywacja z modalem potwierdzającym (wpisanie słowa DEZAKTYWUJ) i revoke refresh tokenów.
- Rejestracja każdej akcji w \`audit_logs\` z \`target_user_id\` i \`performed_by\` (brak haseł i PII w audycie).

### ✅ Kryteria Akceptacji
- **AC1:** Lista personelu zawiera akcje: „Zresetuj hasło”, „Zawieś konto”, „Przywróć konto”.
- **AC2:** Próba operacji na pracowniku z innej placówki zwraca błąd 403 Forbidden.
- **AC3:** Po resecie lub zawieszeniu konta aktywne sesje pracownika są natychmiast unieważniane.`
  },
  {
    num: 5,
    idList: '6aa2a316ec44665e95bbeb48', // Security (SEC)
    name: 'Do implementacji jako 5, Kontrolowany podgląd PESEL jako pracownik (Step-Up Auth & Rejestr Audytowy)',
    desc: `### 📖 User Story
**Jako** uprawniony pracownik placówki (\`nurse\`, \`org_admin\`),
**Chcę** mieć możliwość jednorazowego podejrzenia numeru PESEL podopiecznego po podaniu swojego hasła (Step-Up Authentication) i wskazaniu powodu,
**Aby** wpisać numer do oficjalnej dokumentacji NFZ/ZUS/karty medycznej, mając pewność, że każda próba wglądu jest w 100% rejestrowana w niezmiennym rejestrze audytowym.

### ⚙️ Wymagania Techniczne & Architektura
- Szyfrowanie odwracalne (\`pesel_encrypted\` AES-GCM-256 z kluczem w KMS) + zachowanie \`pesel_hash\` do wyszukiwania.
- Step-Up Authentication: modal z zamaskowanym PESEL-em (\`850401•••••\`), ponowne podanie hasła i wybór powodu (np. NFZ_RECEPTA, PRZYJECIE_SZPITAL).
- Transient Reveal: odsłonięty numer znika po 30 sekundach; brak zapisu w LocalStorage/SessionStorage.
- Immutable Audit: każda próba (udana i nieudana) trafia do \`audit_logs\` i \`security_access_logs\` bez numeru PESEL w payloadzie.

### ✅ Kryteria Akceptacji
- **AC1:** PESEL jest domyślnie zamaskowany w UI.
- **AC2:** Błędne hasło pracownika blokuje odsłonięcie i loguje \`AUTH_FAILURE\`.
- **AC3:** Poprawne hasło odsłania numer na maks. 30s i loguje \`AUTH_SUCCESS\`.
- **AC4:** Żaden log nie zawiera jawnego numeru PESEL.`
  },
  {
    num: 6,
    idList: '6aa2a30d5410b68e5cd67f30', // Residents (ADM)
    name: 'Do implementacji jako 6, Kompleksowy kreator przyjęcia pensjonariusza z inteligentną sugestią łóżka',
    desc: `### 📖 User Story
**Jako** Administrator Placówki (\`org_admin\`),
**Chcę** podczas dodawania pensjonariusza wprowadzić kompletne dane administracyjno-opiekuńcze oraz od razu przypisać wolne łóżko z listy lub skorzystać z rekomendacji systemu,
**Aby** w jednym, spójnym kroku przyjąć podopiecznego bez ryzyka rozjechania danych lokalizacyjnych placówki.

### ⚙️ Wymagania Techniczne & Architektura
- Wieloetapowy kreator (Wizard): Krok 1: Tożsamość i metadane (PESEL, autouzupełnianie płci i daty urodzenia, poziom opieki: \`care_level\`, pakiet ZSN).
- Krok 2: Wybór pokoju i łóżka z opcją „Zaproponuj łóżko” (heurystyka: wolne łóżko, zgodność płci w pokoju, kondycja ruchowa).
- Krok 3: Umowa i oświadczenia o zgodach.
- Atomowa transakcja PostgreSQL \`admit_resident_with_bed(...)\` pilnująca niezmiennika jedno łóżko = jeden pensjonariusz (ADR-012).

### ✅ Kryteria Akceptacji
- **AC1:** PESEL automatycznie ustawia datę urodzenia i płeć.
- **AC2:** Przycisk sugestii wskazuje pasujące pokoje z uzasadnieniem dopasowania.
- **AC3:** Kolizja zajętości łóżka powoduje bezpieczny rollback transakcji.`
  },
  {
    num: 7,
    idList: '6aa2a30d5410b68e5cd67f30', // Residents (ADM)
    name: 'Do implementacji jako 7, Masowy import pensjonariuszy z pliku Excel/CSV z walidacją i preview',
    desc: `### 📖 User Story
**Jako** Administrator Placówki (\`org_admin\`),
**Chcę** wgrać plik Excel (.xlsx) lub CSV z listą pensjonariuszy placówki, przejść przez etap podglądu błędów i zatwierdzić import,
**Aby** w ciągu kilku minut przenieść stan placówki ze starego oprogramowania bez ręcznego wprowadzania dziesiątek osób.

### ⚙️ Wymagania Techniczne & Architektura
- Dwuetapowy import: Dry-Run (analiza składni, walidacja PESEL, duplikaty) -> Podgląd tabelaryczny (wiersze poprawne i błędne) -> Zapis transakcyjny w partiach (chunk insert).
- Pobranie wzorcowego szablonu \`.xlsx\` z nagłówkami.
- Automatyczne haszowanie/szyfrowanie PESEL i generowanie eventów \`admission\`.
- Zbiorczy wpis w \`audit_logs\` z liczbą zaimportowanych rekordów.

### ✅ Kryteria Akceptacji
- **AC1:** Możliwość pobrania szablonu Excel z panelu.
- **AC2:** Błędne wiersze są wyróżnione z jasnym komunikatem o przyczynie błędu.
- **AC3:** Opcja importu wyłącznie poprawnych wierszy.`
  },
  {
    num: 8,
    idList: '6aa2a30d5410b68e5cd67f30', // Residents (ADM)
    name: 'Do implementacji jako 8, Bezpieczny eksport danych placówki i listy podopiecznych (CSV/XLSX/PDF)',
    desc: `### 📖 User Story
**Jako** Administrator Placówki (\`org_admin\`),
**Chcę** wyeksportować aktualne zestawienie placówki (dane podopiecznych, przypisania pokoi, statusy umów i pakiety ZSN) do pliku XLSX / CSV / PDF,
**Aby** przygotować sprawozdawczość dla organów nadzorczych lub zestawienia operacyjne dla personelu.

### ⚙️ Wymagania Techniczne & Architektura
- Filtry eksportu: pensjonariusze aktywni / zarchiwizowani, stan pokoi, pakiety ZSN.
- Formaty: XLSX, CSV (UTF-8 z BOM pod Excel), PDF.
- Guardy MDR i RODO: brak danych medycznych (ADR-005), PESEL domyślnie zamaskowany (eksport jawnego wymaga uprawnień i re-auth).
- Rejestracja pobrania pliku w \`audit_logs\`.

### ✅ Kryteria Akceptacji
- **AC1:** Formularz wyboru formatu i zakresu danych na \`/admin/residents\`.
- **AC2:** Prawidłowe kodowanie polskich znaków diakrytycznych w arkuszu.
- **AC3:** Audytowanie każdego wygenerowanego eksportu.`
  },
  {
    num: 13,
    idList: '6aa2a310eb8f2e18f6ccd50f', // Voice
    name: 'Do implementacji jako 13, Strażnik kompletności raportu opiekuńczego dla rodziny (AI Quality Gate)',
    desc: `### 📖 User Story
**Jako** Pielęgniarka / Opiekun zatwierdzający dzienny raport dla rodziny,
**Chcę**, aby asystent w trakcie dyktowania/edycji notatki sprawdził, czy odpowiedziałam na kluczowe pytania rodziny (apetyt, nastrój, aktywność, sen) i podpowiedział brakujące obszary,
**Aby** bliscy otrzymali wartościowy raport, a personel nie musiał odpowiadać na powtarzające się telefony.

### ⚙️ Wymagania Techniczne & Architektura
- Matryca 4 wymiarów troski rodziny: posiłki/apetyt, nastrój/samopoczucie, aktywność/integracja, sen/wypoczynek.
- Analiza wyłącznie na strumieniu BEHAVIORAL po odcięciu danych medycznych (ADR-005, ADR-007).
- Interaktywna checklista w UI personelu z nienarzucającymi się sugestiami (Nudge).
- Brak blokady publikacji – personel zachowuje pełną decyzyjność.

### ✅ Kryteria Akceptacji
- **AC1:** Notatka bez wzmianki o posiłkach i nastroju wyświetla żółty wskaźnik brakujących informacji.
- **AC2:** Komunikaty asystenta nie używają słownictwa klinicznego i słowa „pacjent” (ADR-004).
- **AC3:** Pielęgniarka może opublikować raport jednym kliknięciem mimo braków.`
  },
  {
    num: 14,
    idList: '6aa2a3135ec81511fdaddb5c', // Presentation (MDR/UI)
    name: 'Do implementacji jako 14, Granularna edycja wszystkich potrzebnych elementów w UI (Inline & Sheet Editing)',
    desc: `### 📖 User Story
**Jako** Użytkownik panelu (Admin placówki lub Opiekun),
**Chcę** mieć możliwość szybkiej, kontekstowej edycji poszczególnych danych bezpośrednio w wierszu tabeli lub w wysuwanym panelu (Drawer/Sheet),
**Aby** nie przechodzić przez wieloekranowe formularze przy drobnych, codziennych zmianach.

### ⚙️ Wymagania Techniczne & Architektura
- Komponenty edycji w miejscu (Inline Input) oraz wysuwane panele Sheet (\`@/components/ui/sheet\`).
- Optymistyczne aktualizacje UI (\`useOptimistic\`) z natychmiastowym feedbackiem i obsługą rollbacku przy błędzie.
- Weryfikacja uprawnień wg macierzy \`MATRIX\` z kontraktu ról.
- Dostępność a11y (ADR-011) – cele dotykowe min. 48px, obsługa klawiaturą.

### ✅ Kryteria Akceptacji
- **AC1:** Kliknięcie ikony edycji otwiera edycję w miejscu bez przeładowania podstrony.
- **AC2:** Błąd sieci natychmiast przywraca poprzednią wartość i wyświetla powiadomienie Toast.
- **AC3:** Każda edycja rejestruje zmienione pola w audycie.`
  },
  {
    num: 15,
    idList: '6aa2a30fc2cc260f25866873', // Staff (NUR)
    name: 'Do implementacji jako 15, Optymalizacja i automatyzacja codziennych ścieżek personelu (Click-Reduction Engine)',
    desc: `### 📖 User Story
**Jako** Pielęgniarka na codziennym dyżurze w placówce,
**Chcę** mieć skrócone i zautomatyzowane ścieżki powtarzalnych czynności (masowe zatwierdzanie draftów raportów, rejestracja rutynowych aktywności jednym kliknięciem, skróty klawiszowe),
**Aby** zredukować czas spędzany przed ekranem z 2 godzin do 20 minut dziennie i poświęcić ten czas pensjonariuszom.

### ⚙️ Wymagania Techniczne & Architektura
- Akcja masowego zatwierdzania: checkbox „Zaznacz wszystkie zweryfikowane” + przycisk publikacji zbiorczej.
- Quick-Rounds Mode: kafelkowy widok obchodu z dużymi przyciskami stanu pod smartfon/tablet.
- Globalna paleta poleceń Command Palette (\`Cmd+K\` / \`Ctrl+K\`) do błyskawicznego wyboru pensjonariusza i dyktowania.

### ✅ Kryteria Akceptacji
- **AC1:** Możliwość jednoczesnego zatwierdzenia do 10 raportów dziennych jednym kliknięciem.
- **AC2:** Wyszukiwarka \`Cmd+K\` filtruje podopiecznych i otwiera dyktowanie w czasie < 2 sekund.
- **AC3:** Ścieżka rejestracji notatki skrócona z 7 do 2 kliknięć.`
  }
];

async function run() {
  console.log(`Tworzenie ${newCards.length} nowych kart w Trello...`);
  for (const card of newCards) {
    const params = new URLSearchParams({
      idList: card.idList,
      name: card.name,
      desc: card.desc,
      pos: 'bottom',
      key: apiKey,
      token: token
    });

    const res = await fetch(`https://api.trello.com/1/cards?${params.toString()}`, {
      method: 'POST'
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Utworzono kartę #${card.num}: [${data.id}] "${card.name}"`);
    } else {
      console.error(`✗ Błąd tworzenia karty #${card.num}:`, await res.text());
    }
  }
  console.log('\nWszystkie nowe karty zostały pomyślnie utworzone w Trello!');
}

run().catch(console.error);
