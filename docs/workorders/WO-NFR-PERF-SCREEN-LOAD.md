# WO: NFR-PERF-SCREEN-LOAD — Czas ładowania ekranów panelu

## Wymaganie
Powiązane User Story: brak (proponowane nowe NFR w specyfikacji, np. `NFR-PERF-01`).
Powiązane wymagania kontraktowe: istniejące `ORG-ISOLATION`, `SEC-SESSION`, `UI-TEMPLATE-ALIGNMENT`. **Proponowany nowy:** `NFR-PERF-SCREEN-LOAD`, czyli budżet czasu odpowiedzi serwera dla ekranów panelu (zmiana `contracts/`, okno kontraktowe otwiera człowiek).

## Pomiar wyjściowy (2026-10-29, produkcja `silver-care-six.vercel.app`)
Metoda: Chromium bez interfejsu, kontami E2E (`e2e.admin`, `e2e.nurse`, `e2e.family`), tylko odczyt. Każdy ekran mierzony 3 razy pod rząd w tej samej sesji, w tabeli mediana. Komputer Michała w Polsce, łącze domowe, widok desktopowy 1440×900. Skrypt: `measure.mjs` (katalog roboczy sesji, do przeniesienia do `tools/` w etapie 1).

| Rola | Ekran | TTFB | LCP | Bezczynność sieci | Transfer |
|---|---|---:|---:|---:|---:|
| org_admin | `/admin` | 1195 ms | 1336 ms | 4393 ms | 91 KB |
| org_admin | `/admin/residents` | **1290 ms** | 1416 ms | **6463 ms** | **645 KB** |
| org_admin | `/admin/residents/[id]` | 1062 ms | 1220 ms | 4135 ms | 123 KB |
| org_admin | `/admin/staff` | 1116 ms | 1248 ms | 4241 ms | 89 KB |
| org_admin | `/admin/messages` | 641 ms | 696 ms | 4020 ms | 77 KB |
| org_admin | `/admin/facility` | 641 ms | 780 ms | 3726 ms | 78 KB |
| org_admin | `/admin/reports/daily` | 763 ms | 816 ms | 4249 ms | 82 KB |
| nurse | `/staff` | 644 ms | 864 ms | 3605 ms | 283 KB |
| nurse | `/staff/agenda` | 663 ms | 808 ms | 2270 ms | 62 KB |
| nurse | `/staff/reports` | 534 ms | 700 ms | 2233 ms | 53 KB |
| nurse | `/voice` | 761 ms | 812 ms | 2316 ms | 57 KB |
| family | `/dashboard` | 696 ms | 988 ms | 2276 ms | 34 KB |
| family | `/agenda` | 765 ms | 1008 ms | 2114 ms | 42 KB |
| family | `/messages` | 705 ms | 932 ms | 3536 ms | 40 KB |

Logowanie (od kliknięcia do pierwszego ekranu): org_admin 3220 ms, nurse 1651 ms, family 1967 ms.

**Jak czytać:**
- **TTFB**: czas, po którym serwer zaczyna odpowiadać. To renderowanie RSC i zapytania do bazy.
- **LCP**: moment pojawienia się głównej treści, czyli to, co użytkownik odczuwa.
- **Bezczynność sieci**: chwila, w której przeglądarka przestaje cokolwiek pobierać. Obejmuje odpytywanie w tle i prefetch linków, więc nie jest czasem odczuwalnym.

**Wnioski z pomiaru:**
1. **Wąskim gardłem jest serwer, nie przeglądarka.** LCP jest tylko o 50–300 ms późniejszy niż TTFB, a ekrany panelu prawie nie odpytują Supabase z przeglądarki: 0 zapytań na 12 z 14 ekranów. Wcześniejszy szacunek z przeszukania kodu („15 komponentów pobiera dane w `useEffect`”) nie przełożył się na zapytania z przeglądarki w zmierzonych ekranach.
2. **Panel kierownika jest około 2× wolniejszy** niż panele personelu i rodziny: TTFB 1,1–1,3 s wobec 0,5–0,8 s.
3. **`/admin/residents` pobiera 645 KB**, 7× więcej niż inne ekrany kierownika. Najpewniej to zdjęcia podopiecznych (`AvatarImage src={avatar_url}`) w pełnej rozdzielczości, bez `next/image`.
4. **Logowanie kierownika trwa 3,2 s**, prawie 2× dłużej niż pozostałych ról.

## Hipotezy (do potwierdzenia pomiarem w etapie 1)
| # | Hipoteza | Dowód z kodu | Oczekiwany zysk |
|---|---|---|---|
| H1 | **Trzy kolejne wywołania `auth.getUser()` na każde żądanie** (middleware, layout, strona), każde to osobne zapytanie sieciowe do Supabase Auth | `lib/supabase/middleware.ts:39`, `app/(admin)/layout.tsx:18`, `app/(admin)/admin/residents/page.tsx:15`; `getUser()` występuje w 46 plikach | 150–400 ms na ekran |
| H2 | Zapytania wykonywane po kolei zamiast równolegle | `await` jeden po drugim w stronach panelu kierownika | 100–300 ms na ekranach z wieloma zapytaniami |
| H3 | Funkcje Vercela w `fra1` (Frankfurt), a baza Supabase w `eu-west-1` (Irlandia), więc każde zapytanie to około 20–30 ms w obie strony | `apps/web/vercel.json` `regions: ["fra1"]`, `DATABASE_URL` → `aws-1-eu-west-1` | mnożnik dla H1 i H2 |
| H4 | Zdjęcia podopiecznych w pełnej rozdzielczości | `ResidentsTable.tsx:73` | transfer `/admin/residents` < 150 KB |
| H5 | `select('*')` pobiera kolumny, których ekran nie używa (11 miejsc) | wcześniejszy przegląd | małe dla czasu, istotne dla minimalizacji danych (RODO) |

## Rozwiązanie
1. **Jedna weryfikacja tożsamości na żądanie.**
   - Middleware odświeża sesję i weryfikuje użytkownika.
   - Layout i strona biorą tożsamość z jednej funkcji opakowanej w `React.cache()`, więc wywołanie dzieje się raz na żądanie.
   - Rozważyć `supabase.auth.getClaims()` (lokalna weryfikacja podpisu JWT) zamiast `getUser()` w layoutach i stronach. **Bezpieczeństwo:** lokalna weryfikacja jest równoważna tylko przy asymetrycznych kluczach podpisu JWT w projekcie Supabase, a cofnięta sesja jest widoczna dopiero po wygaśnięciu tokenu. To trzeba sprawdzić i zatwierdzić (Michał i Darek), bo dotyczy `SEC-SESSION`.
   - Rola i placówka nadal wyłącznie z `app_metadata` (reguła `auth-role-from-user-metadata`), a RLS bez zmian.
2. **Zapytania równoległe** (`Promise.all`) tam, gdzie nie zależą od siebie.
3. **Zdjęcia przez `next/image`** z rozmiarem miniatury (40–64 px). Do tego weryfikacja, czy adresy zdjęć są podpisane i krótkotrwałe, bo to wizerunek osoby.
4. **Jawne listy kolumn** zamiast `select('*')` na mierzonych ekranach.
5. **Region:** decyzja, czy przenieść funkcje do `dub1` (Dublin, blisko `eu-west-1`), czy zostać przy `fra1`. To zmiana `vercel.json` i wymaga potwierdzenia, że `INFRA-EU-REGION` dopuszcza oba regiony.
6. **Bez przechowywania danych podopiecznych w przeglądarce.** Dane art. 9 i współdzielone tablety. Ewentualny cache tylko po stronie serwera i tylko dla danych bez danych osobowych (konfiguracja placówki, słowniki).

## Plan etapów (osobne PR-y, każdy RED → GREEN, ≤3 pliki na commit)
| Etap | Zakres | Ryzyko i wycofanie |
|---|---|---|
| 1 | Skrypt pomiaru w `tools/sc-perf.mjs` i nagłówek `Server-Timing` (czas auth, zapytań, renderu) w trybie diagnostycznym. Pomiar potwierdza H1–H3 | Małe. Tylko pomiar |
| 2 | H1: jedna weryfikacja tożsamości na żądanie (`React.cache`). Testy logiki i E2E logowania wszystkich ról | **Średnie**: dotyka sesji. Wycofanie: revert PR |
| 3 | H1 cd.: `getClaims()` w layoutach i stronach, **po decyzji bezpieczeństwa** | Średnie. Wycofanie: revert PR |
| 4 | H2: `Promise.all` w panelu kierownika (`/admin`, `/admin/residents`, `/admin/staff`, karta podopiecznego) | Małe |
| 5 | H4: miniatury zdjęć przez `next/image` | Małe |
| 6 | H5: jawne kolumny na mierzonych ekranach | Małe |
| 7 | H3: region funkcji, po decyzji | Małe. Wycofanie: zmiana jednego pola |

Po każdym etapie: ponowny pomiar tym samym skryptem i dopisanie wyniku do tego WO.

## Budżet docelowy (do zatwierdzenia jako kryteria `NFR-PERF-SCREEN-LOAD`)
- **TTFB** mediana ≤ 600 ms na każdym zmierzonym ekranie.
- **LCP** mediana ≤ 1000 ms.
- **Transfer** strony listy ≤ 200 KB.
- **Logowanie** do pierwszego ekranu ≤ 2000 ms dla każdej roli.

## Weryfikacja
- Pomiar przed i po każdym etapie, ta sama metoda, wyniki w tabeli powyżej.
- Testy logiki: jedna weryfikacja tożsamości na żądanie; brak tożsamości → odmowa przed zapytaniem.
- E2E Playwright: logowanie i nawigacja wszystkich ról bez regresji (`pnpm test:e2e`).
- Pełna bramka `bash scripts/verify.sh --full`.

## Decyzje do podjęcia (Michał i Darek)
1. Czy przyjmujemy budżet z sekcji wyżej jako wymaganie w kontrakcie?
2. `getClaims()` zamiast `getUser()` w layoutach i stronach: tak, nie, czy po sprawdzeniu kluczy podpisu JWT w projekcie Supabase?
3. Region funkcji: `fra1` czy `dub1`?
