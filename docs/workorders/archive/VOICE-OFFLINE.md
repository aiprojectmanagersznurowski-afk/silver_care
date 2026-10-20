# Work Order: Tryb Offline Głosu (VOICE-OFFLINE)

## Metadane
- **Wymagania:** `VOICE-OFFLINE`
- **Domena:** voice
- **Ryzyko:** MEDIUM
- **Powiązania:** `supabase/migrations/20260902020000_voice_offline.sql`, `apps/web/src/app/api/voice/transcribe/route.ts`, `tests/logic/voice_offline.test.ts`, `tests/logic/voice_sync.test.ts`

## Cel
Zapewnienie ciągłości pracy opiekunów i pielęgniarek w warunkach braku łączności sieciowej (np. w piwnicach, na klatkach schodowych lub w skrzydłach budynku ze słabym zasięgiem Wi-Fi) poprzez lokalne buforowanie nagrań i ich idempotentną synchronizację po odzyskaniu połączenia.

## Kryteria Akceptacji
1. Baza danych wspiera unikalny identyfikator klienta (`client_uuid UUID UNIQUE`) w tabeli notatek głosowych, zapobiegając duplikacji wpisów przy retransmisji.
2. Endpoint API transkrypcji (`/api/voice/transcribe`) akceptuje pole `client_uuid` z żądania multipart/form-data.
3. Klient przechowuje nagrania w lokalnej pamięci podręcznej i ponawia wysyłkę z zachowaniem tego samego `client_uuid`.

## Podsumowanie Realizacji
- **MIGRACJA:** W `supabase/migrations/20260902020000_voice_offline.sql` dodano kolumnę `client_uuid` z indeksem unikalnym.
- **API ROUTE:** W `apps/web/src/app/api/voice/transcribe/route.ts` wprowadzono odbiór parametru `client_uuid` z `formData` i idempotentny zapis.
- **TESTY:** W `tests/logic/voice_offline.test.ts` i `tests/logic/voice_sync.test.ts` potwierdzono zgodność schematu oraz obsługę w API (`@REQ: VOICE-OFFLINE`).
