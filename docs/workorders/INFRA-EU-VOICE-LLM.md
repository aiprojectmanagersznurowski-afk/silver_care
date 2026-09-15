# Work Order: INFRA-EU-VOICE-LLM

## Wymaganie
Rejestr: INFRA-EU-REGION, INFRA-GROQ-TRANSCRIPTION (ADR-009)

## Opis
Zapewnienie suwerenności danych EOG dla modeli językowych w potoku notatek głosowych:
1. Etap `TRANSCRIBE` (zamiana surowego pliku audio na tekst) pozostaje w Groq na bazie wyjątku ADR-009 (SCC, zerowa retencja, darmowy poziom).
2. Etapy przetwarzające wrażliwe dane zdrowotne (Art. 9 RODO):
   - Krok 1: `CLASSIFY` (podział na strumień medyczny personelu, dyskomfort i zachowanie).
   - Krok 2: `GENERATE` (tworzenie raportu dobowego dla bliskich).
   Zostają przeniesione do klienta modeli językowych hostowanych w Europejskim Obszarze Gospodarczym (`apps/web/src/lib/eu-llm-client.ts`).
3. Domyślna konfiguracja wskazuje na europejski endpoint (`https://api.mistral.ai/v1/chat/completions` z modelem `mistral-small-latest` w regionie UE).
4. Do Groq nie trafia żaden tekstowy prompt z notatką ani zredagowany transkrypt.

## Kryteria akceptacji
- AC1: `apps/web/src/app/api/voice/process/route.ts` nie wykonuje żadnych wywołań do API Groq.
- AC2: Klasyfikacja i generowanie raportu korzystają z modułu `callEuLlmCompletion` ze sprawdzaniem regionu EOG.
- AC3: Pełna weryfikacja automatyczna i zielona bramka `scripts/verify.sh --full`.
