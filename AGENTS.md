# Silver Care — instrukcje dla agentów

Wspólna podstawa dla wszystkich narzędzi agentowych. Szczegóły: `.agents/rules/` i `.claude/CLAUDE.md`.

## Reguła nadrzędna

**Kontrakt w `contracts/*.contract.mjs` jest jedynym źródłem prawdy.** Kod importuje z `@silvercare/contracts`, nie przepisuje wartości. Zmiana kontraktu wymaga otwartego okna: `node tools/sc-contract-window.mjs open <REQ-ID>`.

## Czym jest ten produkt

Narzędzie komunikacji i organizacji codziennego życia placówki. **Nie jest wyrobem medycznym, systemem ratunkowym ani monitoringiem stanu zdrowia.** To przewidziane zastosowanie, od którego zależy klasyfikacja prawna całego produktu.

- Bliscy widzą: kroki, czas aktywności, długość i godziny snu.
- Bliscy nie widzą: tętna, HRV, tętna spoczynkowego, wyniku snu. Dane są zbierane i dostępne personelowi — zakaz dotyczy prezentacji.
- Wolno: „brak aktywności od czterech godzin". Nie wolno: „podejrzenie omdlenia".
- Żadna metryka nie wyzwala powiadomienia. Jedynym wyzwalaczem jest publikacja raportu.
- Słowo „pacjent" jest zakazane w warstwie widocznej dla użytkownika, łącznie z odmianą.

## Dane artykułu 9, prywatność i bezpieczeństwo (Security & GDPR/MDR)

- Bezwzględny obowiązek weryfikacji sesji i ról: RLS w bazie + `api-auth.ts` na poziomie endpointów i Server Actions.
- Surowy zakaz wysyłania niezanonimizowanych danych medycznych/PII do zewnętrznych API LLM (etap REDACT usuwa dane medyczne).
- Zakaz fabrykowania danych w fallbackach (np. wstawiania tekstu „spędził spokojny dzień"). Brak danych = jawna informacja o braku danych.
- Zgodę wyraża pensjonariusz albo opiekun prawny. Rola `family` nie może wyrażać ani cofać zgód.
- Rejestr zgód i rejestr audytowy są niezmienialne.
- Nie loguj danych osobowych. UUID i kody techniczne — tak.
- PESEL wyłącznie jako `pesel_hash`.
- Klucz `service_role` nigdy w warstwie klienta.

## Stack technologiczny i standardy inżynierskie (apps/web)

- Stack w `apps/web`: **Next.js 16 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn + `@base-ui/react`**. Zakaz używania przestarzałych konwencji z Tailwind v3 i React 18.
- Domyślnie używamy **React Server Components (RSC)**. Dyrektywa `'use client'` jest dozwolona wyłącznie w małych liściach drzewa DOM wymagających hooków przeglądarkowych lub bezpośredniej interakcji.
- **Limit rozmiaru pliku:** Żaden komponent ani plik logiki nie może przekraczać **250 linii kodu**.
- **Limit zakresu zmian:** W jednym zadaniu wolno zmodyfikować maksymalnie **3 pliki** (chyba że zadanie dotyczy globalnego refaktoru typów/skryptów).

## Norma UI / Mobile-First

W całym systemie obowiązuje jedna, niesprzeczna norma UI:
- Tekst bazowy (body): `16px` (`text-base`).
- Minimalny dopuszczalny tekst pomocniczy: `14px` (`text-sm`). Klasy `text-xs`, `text-[11px]`, `text-[10px]` są **surowo zabronione**.
- Minimalny cel dotykowy (touch target) dla przycisków/interakcji: `44x44px` (`min-h-11 min-w-11`).
- Tokeny są generowane z kontraktu do `packages/contracts/src/generated/tokens.css`. Używaj zmiennych CSS.
- Kolor nie niesie oceny stanu pensjonariusza (brak czerwieni/zieleni jako oceny). Metryki prezentowane jako fakty (ADR-005).

## Potok głosowy

Architektura potoku: maskowanie PII (PESEL/tel/email) przed modelem → klasyfikacja w modelu UE (DPA, zero retencji) ze strukturą `medication_event` (trafia wyłącznie do `daily_logs` i alertu dla personelu `MedicationAlertBanner`, nigdy do `daily_reports`) → post-filtr MDR przed zapisem.
Trzy strumienie **przed** wejściem do modelu: `MEDICAL` (usuwany, zostaje wyłącznie w brudnopisie personelu `daily_logs`), `DISCOMFORT` (ogólny opis w raporcie), `BEHAVIORAL` (podstawa raportu `daily_reports`). Model nigdy nie ustala tożsamości z nagrania — `resident_id` przychodzi z frontendu jako UUID.

## Rdzeń i integracja

Rdzeń: `organizations`, `residents`. Identyfikatory dostawców żyją w `external_wearable_links` i `external_org_links`. Nazwy `care_homes`, `patients`, `polar_user_id` są porzucone.

## Specyfikacja user stories

`docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md` to narracyjna warstwa dokumentacji (kto, po co, scenariusze). **Nie jest źródłem prawdy** — przy sprzeczności wygrywa kontrakt i ADR.

- Funkcja niepokryta istniejącym story → nowe story z kolejnym ID w domenie (np. `SC-NUR-11`) **przed** Work Orderem, ze statusem `📝 PROPOZYCJA`.
- Każde story ma linię `🔗 Kontrakt` z ID `@REQ` albo `brak REQ`; nowe wymaganie w kontrakcie wskazuje story w polu `source`.
- Zmiana zakresu funkcji = aktualizacja story w tym samym PR co kod.

## Pętla

```
PLAN → CONTRACT (jeśli trzeba) → RED → GREEN → VERIFY → REVIEW → PR CREATED (HANDOFF) → REVIEWER MERGE
```

`node tools/sc-phase.mjs red|green|contract` pilnuje granicy faz. Każdy test niesie `@REQ: <ID>`.

Dla zmian i scenariuszy w warstwie frontendu (`apps/web`): faza RED wymaga testów Playwright E2E w `e2e/` z Page Object Model, a weryfikacja obejmuje `pnpm test:e2e`.

## Przed zamknięciem zadania (INFRA-SDLC-WORKFLOW)

1. Bramka jakościowa:
```bash
bash scripts/verify.sh --full
```
Etap POMINIĘTY to brak dowodu, nie sukces.

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

## Czego nie robisz sam

Otwarcie okna kontraktowego i publikacja raportu do bliskich należą do człowieka.
**Zakaz samodzielnego merge do gałęzi głównej (`main`):** Autor nigdy nie wykonuje merge własnego Pull Requesta. Merge'a i przeniesienia karty do 'Done' dokonuje wyłącznie druga osoba z zespołu (Darek lub Michał) po pozytywnym Code Review.
