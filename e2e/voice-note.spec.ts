import postgres from 'postgres';
import { VOICE_RETENTION } from '../packages/contracts/src/generated/voice';
import { test, expect } from './fixtures/base-test';
import { ResidentProfilePage } from './page-objects/ResidentProfilePage';

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
  test.beforeEach(async ({ page, context }) => {
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
            this.ondataavailable({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), 'fake-audio-data-chunks'], { type: 'audio/webm' }) });
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
  });

  test('@REQ: VOICE-RESIDENT-ASSIGN - ponawia wysyłkę ogólną po odrzuceniu @REQ: VOICE-OFFLINE', async ({
    loginPage, voiceNotePage, page,
  }) => {
    let requests = 0;
    await page.route('**/api/voice/captures', async (route) => {
      requests++;
      if (requests === 1) {
        await route.fulfill({ status: 403, json: { error: 'Potwierdź drugi składnik uwierzytelniania.' } });
      } else {
        await route.fulfill({ status: 202, json: { success: true, captureId: 'fixture' } });
      }
    });
    await loginPage.loginAs('nurse');
    await voiceNotePage.goto();
    await voiceNotePage.openGeneralRecording();
    await voiceNotePage.startRecording();
    await voiceNotePage.stopRecording();

    await expect(page.getByText('Potwierdź drugi składnik uwierzytelniania.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pobierz nagranie lokalnie' })).toBeVisible();
    await page.getByRole('button', { name: 'Ponów wysyłkę' }).click();
    await expect(page.getByText('Nagranie przyjęto do przetworzenia.', { exact: true })).toBeVisible();
    expect(requests).toBe(2);
  });

  test('nagranie z karty zachowuje prywatne źródło po utracie odpowiedzi @REQ: VOICE-OFFLINE @REQ: VOICE-RETENTION @REQ: VOICE-ZERO-GUESSING', async ({
    loginPage, voiceNotePage, page, context,
  }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    const residentId = await card.firstResidentIdFromStaffBoard();
    await card.openStaffCard(residentId);
    await card.voiceNoteLink.click();
    await expect(page).toHaveURL(new RegExp(`/voice/capture\\?resident=${residentId}`));

    const db = postgres((process.env.DATABASE_URL || process.env.POSTGRES_URL)!, { prepare: false });
    const attempts: { status: number; captureId?: string }[] = [];
    try {
      await page.route('**/api/voice/captures', async (route) => {
        const response = await route.fetch();
        attempts.push({ status: response.status(), captureId: (await response.json()).captureId });
        if (attempts.length === 1) {
          await context.setOffline(true);
          await route.abort('connectionreset');
        } else {
          await route.fulfill({ response });
        }
      });

      await voiceNotePage.startRecording();
      await voiceNotePage.stopRecording();
      await expect(page.getByRole('status').getByText('Nagranie zapisano w kolejce offline.')).toBeVisible();
      expect(attempts).toEqual([{ status: 202, captureId: expect.any(String) }]);
      const captureId = attempts[0].captureId!;

      await context.setOffline(false);
      await expect.poll(() => attempts).toEqual([
        { status: 202, captureId }, { status: 202, captureId },
      ]);
      await expect(page.getByRole('status').getByText('Nagranie przyjęto do przetworzenia.')).toBeVisible();
      expect(await db`
        SELECT c.source, c.selected_resident_id, b.public AS bucket_public
        FROM public.voice_captures c
        JOIN storage.objects o ON o.name = c.storage_path AND o.bucket_id = ${VOICE_RETENTION.storageBucket}
        JOIN storage.buckets b ON b.id = o.bucket_id
        WHERE c.id = ${captureId}
      `).toEqual([{ source: 'APP', selected_resident_id: residentId, bucket_public: false }]);
    } finally {
      await context.setOffline(false);
      for (const id of new Set(attempts.flatMap(({ captureId }) => captureId ? [captureId] : []))) {
        await db`DELETE FROM public.voice_captures WHERE id = ${id}`;
      }
      await db.end();
    }
  });

  test('@REQ: VOICE-ZERO-GUESSING - Personel wybiera podopiecznego, nagrywa notatkę i widzi przetranskrybowaną treść', async ({
    loginPage,
    voiceNotePage,
    page
  }) => {
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

test('@REQ: VOICE-RESIDENT-ASSIGN - nagranie ogólne dostępne obok wyboru podopiecznego', async ({ loginPage, voiceNotePage }) => {
  await loginPage.loginAs('nurse');
  await voiceNotePage.goto();
  await voiceNotePage.expectResidentSelectionVisible();
  await voiceNotePage.openGeneralRecording();
});
