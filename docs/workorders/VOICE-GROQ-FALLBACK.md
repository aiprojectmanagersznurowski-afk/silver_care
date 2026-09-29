# Work Order: VOICE-GROQ-FALLBACK

## Wymaganie
Rejestr: INFRA-GROQ-TRANSCRIPTION, INFRA-EU-REGION (ADR-009)

## Opis
Tymczasowy fallback modelu LLM na Groq w potoku notatek głosowych:
1. W module `apps/web/src/lib/eu-llm-client.ts`, jeżeli brak konfiguracji europejskiego dostawcy (`EU_LLM_API_KEY` oraz `MISTRAL_API_KEY`), ale skonfigurowany jest klucz `GROQ_API_KEY`, funkcja `callEuLlmCompletion` automatycznie przekierowuje zapytania klasyfikacji i generowania raportu na Groq (`llama-3.3-70b-versatile` przez endpoint Groq OpenAI-compatible).
2. Jeśli brak jakiegokolwiek klucza API (brak Mistrala i brak Groqa), funkcja rzuca jawny błąd `[EU-LLM-CONFIG]` zamiast stosować ciche mockowanie (zgodnie z `VOICE-REPORT-FIDELITY`).
3. Domyślna konfiguracja `getEuLlmConfig` pozostaje skierowana na EOG (`https://api.mistral.ai/v1/chat/completions`), zachowując zgodność z kontraktem i testami suwerenności.

## Kryteria akceptacji
- AC1: `callEuLlmCompletion` przy obecności `GROQ_API_KEY` (i braku kluczy EU) wykonuje zapytanie do Groqa z modelem `llama-3.3-70b-versatile`.
- AC2: `callEuLlmCompletion` przy braku jakiegokolwiek klucza rzuca błąd konfiguracyjny `[EU-LLM-CONFIG]`.
- AC3: `getEuLlmConfig()` zachowuje domyślny endpoint w EOG.
- AC4: Wszystkie testy jednostkowe i bramka `bash scripts/verify.sh --full` przechodzą na zielono.
