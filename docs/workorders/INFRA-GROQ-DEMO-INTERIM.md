# Work Order: Tymczasowy fallback Groq dla CLASSIFY/GENERATE na czas demo (INFRA-GROQ-DEMO-INTERIM)

## Metadane
- **Wymaganie:** `INFRA-GROQ-DEMO-INTERIM` (nowe)
- **ADR:** ADR-015 — decyzja Michała, 2026-10-06
- **Trello:** karta #146 (brak `EU_LLM_API_KEY` na Vercelu blokuje demo)
- **Domena:** infra / voice
- **Ryzyko:** HIGH — wyjątek od reguły EOG bez podpisanego DPA, ograniczony do danych syntetycznych
- **Zmiana kontraktu:** tak — nowe wymaganie + nowy wpis `PROVIDERS` w `integration.contract.mjs`
- **Powiązania:**
  - `apps/web/src/lib/eu-llm-client.ts`
  - `contracts/integration.contract.mjs`
  - `contracts/requirements.contract.mjs`
  - `docs/REJESTR_PODMIOTOW_PRZETWARZAJACYCH.md`, `01-ADR-decisions.md` (ADR-015, już zaktualizowane w PR #58)

## Cel
Umożliwić generowanie raportów dla bliskich (`CLASSIFY`, `GENERATE`) przez Groq w trybie demo/prezentacji — wyłącznie na danych syntetycznych, przed podpisaniem DPA z Groq na te etapy — bez cichego przywracania fallbacku usuniętego w PR #38.

## Kryteria akceptacji (Given-When-Then)

### AC1: Domyślne zachowanie bez zmian
- **GIVEN** brak klucza EU (`EU_LLM_API_KEY`/`MISTRAL_API_KEY`) i brak zmiennej `ALLOW_DEMO_GROQ_FALLBACK`.
- **WHEN** wywołane jest `callEuLlmCompletion`.
- **THEN** funkcja rzuca `[EU-LLM-CONFIG]`, tak jak dziś (PR #38). Sama obecność `GROQ_API_KEY` (używanego do `TRANSCRIBE`) nic nie zmienia.

### AC2: Tryb demo wymaga jawnej, osobnej flagi
- **GIVEN** brak klucza EU, `GROQ_API_KEY` ustawiony, `ALLOW_DEMO_GROQ_FALLBACK=true`.
- **WHEN** wywołane jest `callEuLlmCompletion`.
- **THEN** żądanie idzie do Groq (`https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`) i zwraca treść odpowiedzi.
- **AND** w logu serwera pojawia się ostrzeżenie `[EU-LLM-DEMO-FALLBACK]` bez treści promptu i bez PII.

### AC3: Klucz EU ma pierwszeństwo
- **GIVEN** `ALLOW_DEMO_GROQ_FALLBACK=true` i jednocześnie poprawny klucz EU.
- **WHEN** wywołane jest `callEuLlmCompletion`.
- **THEN** żądanie idzie do dostawcy EU (Mistral), nie do Groq — flaga demo jest tylko awaryjna, nie nadrzędna.

### AC4: Nieprawidłowy endpoint EU nadal odrzucany
- **GIVEN** `EU_LLM_ENDPOINT` ustawiony na host spoza EOG (np. Groq, xAI, OpenAI) i poprawny klucz EU, `ALLOW_DEMO_GROQ_FALLBACK` nieważne.
- **WHEN** wywołane jest `callEuLlmCompletion`.
- **THEN** funkcja rzuca `[EU-LLM-REGION]` bez wysłania żądania — zachowanie z PR #38 bez zmian.

### AC5: Kontrakt udokumentowany, nie cichy
- **GIVEN** nowy wpis `GROQ_DEMO_LLM` w `PROVIDERS`.
- **THEN** `transferMechanism`, `exceptionApprovedBy`, `exceptionReason` wypełnione zgodnie z `R22-transfer-exception`; `exceptionReason` jawnie stwierdza brak DPA i ograniczenie do danych syntetycznych.

## Granice
- Nie ma technicznego mechanizmu uniemożliwiającego włączenie flagi na organizacji z prawdziwymi danymi — to dyscyplina operacyjna (ADR-015, „Co pozostaje otwarte").
- Nie zmieniamy `TRANSCRIBE` ani istniejącego wpisu `GROQ` w `PROVIDERS`.
- Model i endpoint Groq są stałe w kodzie (nie w kontroli użytkownika) — zero ryzyka SSRF przez zmienną środowiskową.

## Komendy
```bash
node tools/sc-contract-window.mjs open INFRA-GROQ-DEMO-INTERIM
node tools/sc-phase.mjs contract|red|green
bash scripts/verify.sh --full
```
