# Work Order: Korekta i Uzupełnianie Notatki (VOICE-FOLLOWUP)

## Metadane
- **Wymagania:** `VOICE-FOLLOWUP`
- **Domena:** voice
- **Ryzyko:** LOW
- **Powiązania:** `tests/logic/voice_followup.test.ts`, `tests/logic/voice_sync.test.ts`, `apps/web/src/app/api/voice/transcribe/route.ts`

## Cel
Umożliwienie modelowi AI wykrywania brakujących lub niejednoznacznych informacji w notatce głosowej personelu oraz umożliwienie personelowi łatwego uzupełnienia lub skorygowania istniejącego szkicu bez konieczności powtarzania całej wypowiedzi.

## Kryteria Akceptacji
1. W przypadku wykrycia luk informacyjnych (np. ogólnikowe stwierdzenie o zmianie leku bez podania dawki) model generuje pytanie uściślające (`followup_question`), a stan szkicu przechodzi w `NEEDS_FOLLOWUP`.
2. Przy podaniu identyfikatora istniejącego szkicu (`draft_id`) nowa transkrypcja zostaje bezpiecznie dołączona do istniejącego wpisu z oznaczeniem uzupełnienia (`[UZUPEŁNIENIE:]`).
3. Zachowanie pełnej historii wpisów bez utraty oryginalnego kontekstu.

## Podsumowanie Realizacji
- **LOGIKA DOPYTANIA:** System rozpoznaje potrzebę uzupełnienia i ustawia odpowiedni status roboczy w przepływie głosu.
- **DOPISYWANIE TREŚCI:** Obsługa parametru `draft_id` w potoku transkrypcji z precyzyjnym łączeniem kolejnych nagrań.
- **TESTY:** Zweryfikowano w `tests/logic/voice_followup.test.ts` oraz `tests/logic/voice_sync.test.ts` (`@REQ: VOICE-FOLLOWUP`).
