# Work Order: VOICE-ASYNC-PIPELINE

## Wymaganie
Rejestr: VOICE-ZERO-GUESSING, VOICE-OFFLINE, REPORT-APPROVAL

## Opis
Asynchroniczne przetwarzanie notatek głosowych personelu z kolejkowaniem i obsługą prób:
1. Endpoint `POST /api/voice/submit` przyjmujący nagranie/draft i zwracający status HTTP 202 Accepted z `draft_id` i statusem `QUEUED` w czasie poniżej 1.5 sekundy.
2. Rozszerzenie `voice_draft_notes` o statusy przetwarzania w kolejce:
   - `IDLE`, `QUEUED`, `TRANSCRIBING`, `CLASSIFYING`, `READY_FOR_APPROVAL`, `NEEDS_FOLLOWUP`, `FAILED_TRANSIENT`, `FAILED_PERMANENT`
   - kolumny `attempts`, `max_attempts` (domyślnie 3), `processing_started_at`, `last_error`.
3. Funkcja PostgreSQL `fetch_next_voice_job()` pobierająca zadanie z kolejki atomowo przez `FOR UPDATE SKIP LOCKED` z obsługą ponowień w przypadku timeoutu (> 5 min).
4. Idempotencja na podstawie `client_uuid` (zgodnie z `VOICE-OFFLINE`).
5. Bezwzględna zasada `VOICE-ZERO-GUESSING` i brak przekazywania `resident_id` ani danych osobowych do modelu LLM.

## Kryteria akceptacji
- AC1: `POST /api/voice/submit` zwraca kod 202 z `draft_id` i statusem `QUEUED`.
- AC2: Błąd transkrypcji/modelu powoduje inkrementację prób i status `FAILED_TRANSIENT`. Po przekroczeniu `max_attempts` zadanie przechodzi w `FAILED_PERMANENT`.
- AC3: Model LLM nie otrzymuje tożsamości pensjonariusza; ponowne złączenie następuje w bazie przez `draft.resident_id`.
