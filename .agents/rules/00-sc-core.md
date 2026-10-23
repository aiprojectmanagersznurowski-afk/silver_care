<!-- WYGENEROWANE z .claude/CLAUDE.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->
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

## Dane osobowe, zdrowotne i bezpieczeństwo (Security & GDPR/MDR)

Wszystko, co dotyczy pensjonariusza, to dane szczególnej kategorii z artykułu 9 RODO. Z tego wynika:

- **Bezwzględny obowiązek weryfikacji sesji i ról**: RLS po stronie bazy danych + weryfikacja w `api-auth.ts` na poziomie endpointów i Server Actions.
- **Surowy zakaz wysyłania niezanonimizowanych danych medycznych/PII do zewnętrznych API LLM**: dane medyczne muszą zostać wycięte przed modelem (etap REDACT).
- **Zakaz fabrykowania danych w fallbackach**: surowy zakaz wstawiania zmyślonych faktów w fallbackach (np. tekstu „spędził spokojny dzień"). Brak danych = jawna informacja o braku danych.
- **Zgodę może wyrazić wyłącznie pensjonariusz albo jego opiekun prawny.** Rola `family` nie może wyrażać ani cofać zgód — to dwie różne role, nie dwa odcienie tej samej.
- **Rejestr zgód i rejestr audytowy są niezmienialne.** Cofnięcie zgody to nowy stan przez `revoked_at`, nie edycja wiersza.
- **Nie loguj danych osobowych.** Wolno logować `residentId` jako UUID i kody techniczne. Nie wolno logować obiektów z treścią notatek, imionami, PESEL-em.
- **PESEL wyłącznie jako `pesel_hash`.** Brak wartości jawnej w bazie, w logach i w treści zaproszeń.
- **Klucz `service_role` omija RLS** i nie ma prawa pojawić się w warstwie klienta.

## Stack technologiczny i standardy inżynierskie (apps/web)

- **Stack**: **Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn + `@base-ui/react`**. Zakaz używania przestarzałych konwencji z Tailwind v3 i React 18.
- **RSC domyślnie**: Domyślnie używamy **React Server Components (RSC)**. Dyrektywa `'use client'` jest dozwolona wyłącznie w małych liściach drzewa DOM wymagających hooków przeglądarkowych lub bezpośredniej interakcji ze stanem klienta.
- **Limit rozmiaru pliku**: Żaden komponent ani plik logiki nie może przekraczać **250 linii kodu**. W przypadku zbliżania się do limitu podziel komponent na mniejsze podkomponenty lub wyodrębnij logikę do pomocniczych modułów.
- **Limit zakresu zmian**: W jednym zadaniu wolno zmodyfikować maksymalnie **3 pliki** (chyba że zadanie dotyczy globalnego refaktoru typów/skryptów).

## Norma UI / Mobile-First

W całym systemie obowiązuje jedna, niesprzeczna norma UI:
- **Tekst bazowy (body)**: `16px` (`text-base`).
- **Minimalny dopuszczalny tekst pomocniczy**: `14px` (`text-sm`). Klasy `text-xs`, `text-[11px]`, `text-[10px]` są **surowo zabronione**.
- **Minimalny cel dotykowy (touch target)**: dla przycisków i elementów interaktywnych wynosi **38x38px** (`min-h-touch min-w-touch`, ADR-018).
- Tokeny są generowane z kontraktu do `packages/contracts/src/generated/tokens.css`. Nie wpisujesz wartości kolorów ani odstępów na sztywno — używasz zmiennych CSS.
- **Kolor nie niesie oceny**: zakaz czerwieni/zieleni jako oceny stanu zdrowia. Czerwień wyłącznie dla błędów technicznych w panelu personelu.
- **Metryki prezentujesz jako fakty**, bez wykresów sugerujących trend lub ocenę kondycji (ADR-005).
- **Wspólne komponenty ekranu (ADR-017)**: nowy lub zmieniany ekran składa się z `apps/web/src/components/patterns/`: `PageHeader` (jedyny `h1` strony), `StatusBadge` (tony `neutral` i `brand`), `TableCard` z `TableStateRow` oraz `ListEmpty` / `ListLoading` / `ListError` (stany list). Nie pisz własnych nagłówków stron, plakietek statusu ani ramek tabel. Surową paletę Tailwind (np. `bg-amber-500`) blokuje reguła `ui-raw-palette`.

## Potok głosowy

Architektura potoku: maskowanie PII (PESEL/tel/email) przed modelem → klasyfikacja w modelu UE (DPA, zero retencji) ze strukturą `medication_event` (wyłącznie do `daily_logs` i alertu dla personelu `MedicationAlertBanner`, nigdy do `daily_reports`) → post-filtr MDR przed zapisem.
Transkrypt dzieli się na trzy strumienie **zanim** trafi do modelu:

1. `MEDICAL` — leki, diagnozy, wyniki badań, parametry życiowe oraz `medication_event`. Usuwane z transkryptu przed wysłaniem do LLM generującego raport. Zapisywane wyłącznie w brudnopisie personelu (`daily_logs`).
2. `DISCOMFORT` — zdarzenia naruszające godność. Oryginał w brudnopisie, do raportu trafia ogólny opis.
3. `BEHAVIORAL` — podstawa raportu dla bliskich (`daily_reports`).

Model **nigdy** nie ustala tożsamości pensjonariusza z nagrania. Frontend przekazuje `resident_id` jako UUID, transkrypt idzie do modelu anonimowy, złączenie następuje w pamięci funkcji brzegowej przed zapisem. Brak identyfikatora w żądaniu kończy się odmową, nie próbą rozpoznania.

## Rdzeń i warstwa integracyjna

Rdzeń nazywa się `organizations` i `residents`. Identyfikatory dostawców nie mieszkają na tabelach rdzenia — żyją w `external_wearable_links` i `external_org_links`. Nazwy `care_homes`, `patients` i `polar_user_id` są porzucone i dozwolone wyłącznie w warstwie integracyjnej.

Powód: jeden pensjonariusz może jutro mieć drugie urządzenie innego producenta. Gdyby `polar_user_id` siedział na rekordzie seniora, każdy nowy dostawca oznaczałby migrację rdzenia.

## Specyfikacja user stories

`docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md` opisuje kto, po co i w jakich scenariuszach korzysta z funkcji. Nie jest źródłem prawdy — przy sprzeczności wygrywa kontrakt i ADR. Funkcja niepokryta istniejącym story dostaje nowe story (kolejne ID w domenie, status `📝 PROPOZYCJA`) przed Work Orderem. Każde story wskazuje `@REQ` albo `brak REQ`; nowe wymaganie w kontrakcie wskazuje story w polu `source`. Zmiana zakresu funkcji = aktualizacja story w tym samym PR.

## Pętla pracy

```
PLAN → CONTRACT (jeśli trzeba) → RED → GREEN → VERIFY → REVIEW → PR CREATED (HANDOFF) → REVIEWER MERGE
```

W fazie RED powstaje wyłącznie test i musi być czerwony. W fazie GREEN wyłącznie implementacja. Sprawdzenie granicy faz:

```bash
node tools/sc-phase.mjs red    # albo green, albo contract
```

Każdy test niesie znacznik `@REQ: <ID>` wskazujący wymaganie z rejestru. Test bez znacznika nie przechodzi bramki.

**Obowiązek testów E2E dla frontendu (`apps/web`):**
Każde nowe story, widok, formularz lub zmiana interakcji w warstwie UI musi posiadać testy E2E w Playwright:
- Faza **RED** obejmuje utworzenie lub rozszerzenie testu w `e2e/` (lub dedykowanego zestawu roli w `e2e/roles/`) w oparciu o Page Object Model (`e2e/page-objects/`) ze znacznikiem `@REQ: <ID>`. Test musi być najpierw czerwony.
- Faza **GREEN** doprowadza test do zieleni bez modyfikacji asercji testowych.
- Faza **VERIFY** przed zamknięciem zadania wymaga potwierdzenia wykonania `pnpm test:e2e`.

## Zanim zamkniesz zadanie (INFRA-SDLC-WORKFLOW)

1. Bramka jakościowa:
```bash
bash scripts/verify.sh --full
```
Etap oznaczony jako POMINIĘTY to brak dowodu, a nie sukces. Jeżeli bramka nie mogła się wykonać, powiedz to wprost zamiast raportować zieleń.

2. Przekazanie do review (Handoff):
```bash
node tools/sc-pr-handoff.mjs <CARD-ID>
```
Zawsze na koniec pracy:
- Przenieś kartę na Trello do listy **PR Created / In Review** i przypisz ją do drugiej osoby (Darek ↔ Michał).
- Otwórz lub zaktualizuj Pull Request na GitHubie i przypisz partnera jako recenzenta.

## Zasada pytań i obsługa sprzeczności (Koniec zasady „Zero Pytań”)

W projekcie **nie obowiązuje** zasada „zero pytań / pełna autonomia przy niejasnościach”.
Nowa reguła nadrzędna:
**W przypadku wykrycia sprzeczności między kontraktem, istniejącym kodem a poleceniem użytkownika — ZATRZYMAJ SIĘ i zadaj 1 precyzyjne pytanie weryfikujące przed zapisaniem plików.**

Decyzje techniczne mieszczące się w kontrakcie (odwracalne, bez wpływu na dane osobowe i granice prawne) realizujesz zgodnie z `DEFAULTS` z `autonomy.contract.mjs`. Jeśli jednak polecenie użytkownika lub istniejący kod koliduje z kontraktem lub granicami MDR/RODO — zadaj pytanie.

## Czego nie robisz sam

Otwarcie okna kontraktowego i publikacja raportu do bliskich należą do człowieka.
**Zakaz samodzielnego merge do gałęzi głównej (`main`):** Autor nigdy nie wykonuje merge własnego Pull Requesta. Merge'a i przeniesienia karty do 'Done' dokonuje wyłącznie druga osoba z zespołu (Darek lub Michał) po pozytywnym Code Review.
