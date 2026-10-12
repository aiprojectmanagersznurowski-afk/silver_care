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

    // Logowanie jako personel opiekuńczy
    await loginPage.loginAs('nurse');
    await expect(page).toHaveURL(/\/staff$/);

    // Przejście do modułu notatki głosowej
    await voiceNotePage.goto();
    await voiceNotePage.expectResidentSelectionVisible();

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

    // Mock getUserMedia i MediaRecorder w kontekście strony, aby test działał powtarzalnie w headless
    await page.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          return dst.stream;
        };
      }
    });

    // Wybór pierwszego dostępnego podopiecznego
    await voiceNotePage.selectFirstResident();
    await voiceNotePage.expectRecordingControlsVisible();

    // Rozpoczęcie i zakończenie nagrywania
    await voiceNotePage.startRecording();
    await page.waitForTimeout(500);
    await voiceNotePage.stopRecording();

    // Weryfikacja: po zakończeniu nagrania treść transkrypcji MUSI pojawić się na ekranie
    await voiceNotePage.expectTranscriptionVisible('Senior zjadł pełne śniadanie');
  });
});
