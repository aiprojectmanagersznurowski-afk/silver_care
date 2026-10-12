# Work Order: Naprawa finalizacji nagrania notatki głosowej (VOICE-NOTE-RECORDING-FINISH)

## Problem
Jako personel opiekuńczy, po kliknięciu w menu „Notatka głosowa” (`/voice`), wybraniu podopiecznego i nagraniu dźwięku, po zakończeniu nagrywania nic się nie działo w interfejsie użytkownika.

## Przyczyny źródłowe
1. **Niezgodność kontraktu odpowiedzi API z frontendem:**
   - `/api/voice/transcribe` zwracał `{ text: finalTranscript, newChunk: ... }` (pole `text`).
   - `apps/web/src/app/(staff)/voice/page.tsx` odczytywał `data.transcript`.
   - W efekcie `transcription` w stanie React stawało się `undefined`, ukrywając sekcję edycji notatki i budowania raportu (`{transcription && ...}`).
2. **Propagacja błędu 401 z zewnętrznego API Groq:**
   - Jeśli Groq API zwróci 401 (np. nieaktualny klucz lub błąd dostawcy), endpoint `/api/voice/transcribe` przekazywał ten status do frontendu.
   - Frontend traktował każdy status 401 jako wygaśnięcie sesji Supabase użytkownika (`setError('Sesja wygasła...')` i przekierowanie do `/login`).
   - Błędy dostawcy zewnętrznego muszą być mapowane na status 502 (Bad Gateway).
3. **Brak obsługi pustej mowy / 0-bajtowych nagrań:**
   - Gdy mowa nie została wykryta lub nagranie było puste, brakowało komunikatu błędu i interfejs milcząco wracał do stanu początkowego.
4. **Przedwczesne wyłączanie ścieżek audio (`MediaStream.getTracks()`):**
   - Synchroniczne wywołanie `track.stop()` w `stopRecording` przed zdarzeniem `onstop` MediaRecordera w silnikach WebKit/Safari powodowało utratę bufora i zerowy rozmiar chunka.

## Zakres zmian
1. **Endpoint API (`apps/web/src/app/api/voice/transcribe/route.ts`):**
   - Zwracanie pól `text` oraz `transcript` w odpowiedzi JSON dla pełnej kompatybilności wstecznej.
   - Mapowanie błędów Groq API na status 502 (Bad Gateway), aby nie mylić ich z sesją użytkownika (401).
2. **Komponent UI (`apps/web/src/app/(staff)/voice/page.tsx`):**
   - Odczyt `data.transcript || data.text || data.newChunk`.
   - Bezpieczne zatrzymywanie ścieżek `stream.getTracks()` wewnątrz `mediaRecorder.onstop`.
   - Walidacja rozmiaru `audioBlob.size > 0` i niepustej treści transkrypcji z czytelnym komunikatem o błędzie w UI.
   - Przekierowanie na `/login` tylko przy autentycznym błędzie braku sesji (`data.error === 'Unauthorized'`).
3. **Testy jednostkowe / logiczne:**
   - Test `tests/logic/voice_transcribe_display.test.ts` weryfikujący zgodność odpowiedzi i obsługę błędów w `/api/voice/transcribe` oraz w komponencie `/voice`.
4. **Testy E2E Playwright:**
   - Test w `e2e/voice-note.spec.ts` z Page Object `e2e/page-objects/VoiceNotePage.ts` sprawdzający przejście z menu do wyboru podopiecznego, nagranie oraz pojawienie się przetłumaczonego tekstu i przycisku generowania raportu.
