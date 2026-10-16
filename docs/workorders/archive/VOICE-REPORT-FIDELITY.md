# Work Order: VOICE-REPORT-FIDELITY

## Wymaganie
Rejestr: VOICE-ZERO-GUESSING (SC-NUR-02/AC2), VOICE-MEDICAL-STRIP (ADR-007), MDR-NO-INTERPRETATION (ADR-005), REPORT-APPROVAL (SC-NUR-03)
Trello: Karta #1 — VOICE-REPORT-FIDELITY (Lista Voice)

## Opis
Rzetelny, wierny faktom generator raportów dla bliskich:
1. Usunięcie reguły `OMIT` z `packages/contracts/src/prompts.ts` — zastąpienie jej zasadą Dignity Translation, która nie zataja dolegliwości podopiecznego, lecz tłumaczy je na godny, uspokajający opis wraz z reakcją personelu i aktualnym statusem.
2. Usunięcie cichego mockowania w `eu-llm-client.ts` (wycinanie zmyślonych opowieści o spacerach i apetycie przy braku klucza API; wymuszenie jawnego błędu).
3. Usunięcie luki bezpieczeństwa (wycieku danych medycznych wg ADR-007) w `extractJson`: w przypadku niepoprawnego JSON od LLM, surowy transkrypt z lekami i diagnozami nie może trafiać do strumienia `behavioral`. Zamiast tego oznaczany jest błąd parsowania.
4. Wyeliminowanie halucynacji w `systemPrompt2` (usunięcie nakazu zmyślania „spokojnego dnia").
5. Usunięcie prymitywnego regexa psującego odmianę gramatyczną w języku polskim.
6. Rejestracja metadanych pochodzenia AI (`ai_model`, `ai_prompt_version`, `ai_generated_at`) przy zapisie do `daily_reports` zgodnie z `AI_PROVENANCE_FIELDS`.

## Kryteria akceptacji
- AC1: `FAMILY_REPORT_PROMPT` nie zawiera dyrektywy `OMIT it from the report` i nakazuje podanie reakcji personelu oraz statusu.
- AC2: `extractJson` przy uszkodzonym JSON nie przepisuje surowego transkryptu do strumienia behawioralnego (`behavioral === null`, `_parseError === true`).
- AC3: `callEuLlmCompletion` rzuca błąd konfiguracyjny przy braku klucza zamiast halucynować stałą odpowiedź.
- AC4: Zapis raportu do tabeli `daily_reports` zawiera pola provenance: `ai_model`, `ai_prompt_version`, `ai_generated_at`.
- AC5: Testy jednostkowe weryfikują ochronę przed zatajaniem danych oraz wyciekiem medycznym.
