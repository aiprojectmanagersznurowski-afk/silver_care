# Konfiguracja krok po kroku

Instrukcja do wykonania **przed** uruchomieniem pierwszego agenta. Każdy krok kończy się sprawdzeniem, po którym wiesz, czy się udało. Nie przechodź dalej, jeśli sprawdzenie nie przechodzi — kolejne kroki na nim polegają.

Czas: około 90 minut, z czego połowa to czekanie na e-maile aktywacyjne.

---

## Krok 1 — Repozytorium

1. Utwórz puste repozytorium na GitHubie, prywatne. Nazwa dowolna, sugeruję `silver-care`.
2. Sklonuj je lokalnie:
   ```bash
   git clone git@github.com:TWOJA-NAZWA/silver-care.git
   cd silver-care
   ```
3. Rozpakuj kit i skopiuj jego zawartość do repozytorium — dokładna lista poleceń jest w `INSTALL.md`.
4. Podepnij bramkę commitową:
   ```bash
   bash scripts/install-git-hooks.sh
   ```

**Sprawdzenie:**
```bash
git config core.hooksPath
```
Musi wypisać `.githooks`. Jeśli nic nie wypisuje, hooki nie są podpięte i bramka commitowa nie zadziała.

---

## Krok 2 — Node i pnpm

```bash
node --version     # musi być 22 lub wyżej
pnpm --version
```

Jeśli brakuje pnpm: `npm install -g pnpm`.

**Sprawdzenie:** obie komendy wypisują numer wersji.

---

## Krok 3 — Bramka działa

Jeszcze bez bazy i bez kluczy — narzędzia bramki są bezzależnościowe i muszą działać od razu.

```bash
node tools/sc-validate.mjs
node tools/sc-selftest.mjs
bash scripts/verify.sh --full
```

**Sprawdzenie:** walidator kończy się `Kontrakty spójne. Ostrzeżeń: 0`, test mutacyjny pokazuje `22/22 reguł`, a bramka kończy się zielono z jednym pominiętym etapem (testy jednostkowe — aplikacji jeszcze nie ma, to poprawne).

Jeśli którykolwiek punkt pada, zatrzymaj się. Bramka jest fundamentem — nie ma sensu konfigurować reszty, dopóki nie działa.

---

## Krok 4 — Supabase

1. Załóż projekt na `supabase.com`.
2. **Region: Frankfurt (eu-central-1).** To nie jest preferencja, tylko wymaganie `INFRA-EU-REGION`. Regionu nie da się później zmienić bez migracji całej bazy.
3. **Plan: darmowy.** Wystarcza na MVP (ADR-013). PITR i rozszerzenie `pgAudit` wymagają planu Pro i są świadomie odłożone — `INFRA-PITR` ma w kontrakcie status `DEFERRED`, nie `TODO`. Rozliczalność operacji wrażliwych (kto usunął, kto impersonował, kto cofnął zgodę) zapewnia tabela `audit_logs` budowana przez aplikację, która nie wymaga planu Pro.
4. Skopiuj z Settings → API: `Project URL`, `anon key`, `service_role key`.
5. Skopiuj z Settings → Database: connection string (tryb transakcyjny i bezpośredni).

**Sprawdzenie:** w panelu projektu widzisz region `eu-central-1`. Plan darmowy jest wystarczający — nie musisz nic upgradować, żeby zacząć.

**Kiedy wrócić do Pro:** przy decyzji o skalowaniu poza pilotaż, albo gdyby zdarzył się incydent wymagający odtworzenia stanu bazy co do sekundy. `deferredUntil` w kontrakcie zapisuje ten warunek wprost, żeby „później" nie oznaczało „nigdy".

---

## Krok 5 — Polar AccessLink

1. Zarejestruj się na `admin.polaraccesslink.com`.
2. Utwórz aplikację. Jako adres przekierowania podaj na razie `http://localhost:3000/api/polar/callback`.
3. Zapisz `client_id` i `client_secret`.

**Uwaga na punkt, na którym zatrzymał się Twój wcześniejszy proof of concept:** wymiana kodu autoryzacyjnego na token wymaga nagłówka `Authorization: Basic base64(client_id:client_secret)`, a **nie** przekazania danych klienta w ciele żądania. Scope to `accesslink.read_all`, endpoint tokenu to `https://polarremote.com/v2/oauth2/token`. Zapisane w kontrakcie w `OAUTH_CONFIG`.

**Sprawdzenie:** masz oba klucze zapisane. Pełny przepływ przetestujesz dopiero z działającą aplikacją — to zadanie pierwszego Work Order dotyczącego integracji.

---

## Krok 6 — Groq (transkrypcja)

1. Załóż konto na `console.groq.com`. Karta nie jest potrzebna — darmowy poziom pokrywa całą skalę MVP.
2. Wygeneruj klucz API.
3. **Włącz zerową retencję danych.** Szukaj w ustawieniach organizacji opcji dotyczącej retencji lub prywatności danych. To jest krok, którego żaden test nie sprawdzi za Ciebie, a `INFRA-GROQ-TRANSCRIPTION` zakłada, że go wykonałeś.

**Sprawdzenie:** w panelu Groq widzisz aktywną opcję zerowej retencji. Zrób zrzut ekranu — przyda się do dokumentacji podprocesorów.

**Dlaczego to ważne:** Groq jest jedynym dostawcą w tym systemie przetwarzającym dane poza EOG (transfer na bazie standardowych klauzul umownych). To świadomy, udokumentowany wyjątek z ADR-009, ograniczony do samej transkrypcji surowego audio. Zerowa retencja jest częścią uzasadnienia tego wyjątku.

---

## Krok 7 — Pozostali dostawcy

Do wyboru na tym etapie, wszystkie muszą działać w EOG:

- **Model językowy** generujący raport — dostawca z umową powierzenia i brakiem retencji zapytań, przetwarzanie w Unii.
- **E-mail** — Resend albo Postmark, region EU.
- **SMS** — dostawca z EOG.

**Sprawdzenie:** dla każdego masz klucz API i potwierdzenie regionu przetwarzania. Jeśli któryś nie ma jasnej deklaracji o EOG, nie włączaj go — reguła `R22` i tak zatrzyma bramkę, dopóki wyjątek nie zostanie udokumentowany jak przy Groq.

---

## Krok 8 — Zmienne środowiskowe

Utwórz plik `.env.local` w korzeniu repozytorium:

```
DATABASE_URL=
DIRECT_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POLAR_CLIENT_ID=
POLAR_CLIENT_SECRET=
POLAR_REDIRECT_URI=http://localhost:3000/api/polar/callback
GROQ_API_KEY=
LLM_API_KEY=
EMAIL_PROVIDER_KEY=
SMS_PROVIDER_KEY=
PESEL_HASH_SALT=
```

Sól do hashowania PESEL wygeneruj losowo i **przechowuj osobno od bazy** — jeśli leży w tym samym miejscu co hash, hashowanie traci sens:
```bash
openssl rand -hex 32
```

**Sprawdzenie:**
```bash
grep -q "^\.env" .gitignore && echo "OK" || echo "DOPISZ .env* DO .gitignore"
```

Klucz `SUPABASE_SERVICE_ROLE_KEY` omija wszystkie polityki dostępu w bazie. Bramka blokuje jego użycie w warstwie klienta, ale przede wszystkim nie może trafić do repozytorium.

---

## Krok 9 — Antigravity

1. Otwórz katalog repozytorium w Antigravity.
2. Zrestartuj aplikację, żeby wczytała `.agents/`.
3. Sprawdź „…" → Customizations.

**Sprawdzenie:** widzisz zakładki Rules (reguły Silver Care), Workflows (sześć komend `/sc-*`) i Hooks (`sc-write-gate`, `sc-bash-gate`, `sc-session-context`).

Dodatkowo warto ustawić tryb wykonywania komend na `Auto`, nie `Turbo`. Hook i tak zablokuje niebezpieczne komendy, ale wdrożenia i `git push` mają trafiać do Ciebie.

---

## Krok 10 — Zależności aplikacji

```bash
pnpm add -D vitest @vitest/coverage-v8 @playwright/test
pnpm exec playwright install --with-deps chromium
```

**Sprawdzenie:**
```bash
bash scripts/verify.sh --full
```
Teraz żaden etap nie powinien być pominięty.

---

## Ustalenia poza kodem

Dwie rzeczy, które warto uruchomić równolegle, bo mają dłuższy czas realizacji niż development:

**Konsultacja prawna** — zgody i role: opiekun prawny kontra rodzina, administrator kontra podmiot przetwarzający. Kontrakt zakłada rozstrzygnięcie z ADR-003. Jeśli prawnik powie inaczej, zmiana idzie przez okno kontraktowe.

**Umowy powierzenia** — z Polar Electro Oy, z dostawcą modelu, z Groq. Do rejestru podprocesorów.

**Regulamin** jasno oddzielający usługę od monitoringu medycznego i systemu ratunkowego. Bez tego powstaje luka oczekiwań: rodzina traktuje portal jak monitoring bliskiego, a produkt nim nie jest.

---

## Pierwsze uruchomienie agenta

```
/sc-plan ORG-ISOLATION
```

Izolacja placówek jest fundamentem — wszystkie pozostałe uprawnienia zakładają, że działa. Kolejność, którą sugeruję: `ORG-ISOLATION` → `SEC-MFA-STAFF` → `CONSENT-GRANTOR` → `ADM-RESIDENT-ADD` → `VOICE-ZERO-GUESSING`.

Agent pracuje samodzielnie i zbiera pytania na koniec sesji. Zatrzyma się i zapyta wyłącznie wtedy, gdy napotka coś z zamkniętej listy `ESCALATION_TRIGGERS` — zmianę kontraktu, granicę MDR, podstawę prawną, nowego dostawcę albo sprzeczność w dokumentach.
