import { test, expect } from './fixtures/base-test';

/**
 * @REQ: VOICE-ZERO-GUESSING
 * @REQ: INFRA-GROQ-TRANSCRIPTION
 *
 * Test E2E sprawdzający ścieżkę personelu:
 * 1. Przejście do notatki głosowej z menu / nawigacja do /voice.
 * 2. Wybór podopiecznego z listy.
 * 3. Nagranie notatki i weryfikacja pojawienia się pola z transkrypcją oraz przyciskiem budowy raportu.
 */

test.describe('Notatka głosowa personelu opiekuńczego (@REQ: VOICE-ZERO-GUESSING)', () => {
  test('@REQ: VOICE-ZERO-GUESSING - Personel wybiera podopiecznego, nagrywa notatkę i widzi przetranskrybowaną treść', async ({
    loginPage,
    voiceNotePage,
    page,
    context
  }) => {
    // Uprawnienia do mikrofonu w przeglądarce
    await context.grantPermissions(['microphone']);

    // Mock getUserMedia i MediaRecorder w kontekście strony przed nawigacją, aby test działał stabilnie w headless
    await page.addInitScript(() => {
      class MockMediaRecorder {
        stream: MediaStream;
        state: 'inactive' | 'recording' | 'paused' = 'inactive';
        mimeType: string = 'audio/webm';
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        constructor(stream: MediaStream) {
          this.stream = stream;
        }

        start() {
          this.state = 'recording';
        }

        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['fake-audio-data-chunks'], { type: 'audio/webm' }) });
          }
          if (this.onstop) {
            this.onstop();
          }
        }

        static isTypeSupported() {
          return true;
        }
      }

      Object.defineProperty(window, 'MediaRecorder', {
        writable: true,
        configurable: true,
        value: MockMediaRecorder
      });

      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          return {
            getTracks: () => [{ stop: () => {} } as MediaStreamTrack],
          } as unknown as MediaStream;
        };
      }
    });

    // Mock API transkrypcji (sprawdzający czy odpowiedź z tekstem odblokowuje widok)
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          text: 'Senior zjadł pełne śniadanie, humor dopisuje, spacer odbył się bez przeszkód.',
          transcript: 'Senior zjadł pełne śniadanie, humor dopisuje, spacer odbył się bez przeszkód.',
          draftId: 'test-draft-uuid-1234'
        })
      });
    });

    // Logowanie jako personel opiekuńczy
    await loginPage.loginAs('nurse');
    await expect(page).toHaveURL(/\/staff$/);

    // Przejście do modułu notatki głosowej
    await voiceNotePage.goto();
    await voiceNotePage.expectResidentSelectionVisible();

    // Wybór pierwszego dostępnego podopiecznego
    await voiceNotePage.selectFirstResident();
    await voiceNotePage.expectRecordingControlsVisible();

    // Rozpoczęcie i zakończenie nagrywania
    await voiceNotePage.startRecording();
    await page.waitForTimeout(300);
    await voiceNotePage.stopRecording();

    // Weryfikacja: po zakończeniu nagrania treść transkrypcji MUSI pojawić się na ekranie
    await voiceNotePage.expectTranscriptionVisible('Senior zjadł pełne śniadanie');
  });
});
