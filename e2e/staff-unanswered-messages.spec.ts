import { test, expect } from './fixtures/base-test';
import { StaffBoardPage } from './page-objects/StaffBoardPage';
import { StaffMessagesPage } from './page-objects/StaffMessagesPage.spec.helper';

/**
 * @REQ: NUR-BOARD
 * @REQ: FAM-MESSAGES
 * @REQ: INFRA-GROQ-TRANSCRIPTION
 *
 * Testy E2E dla wskaźnika nieodpowiedzianych wiadomości na pulpicie dyżuru
 * oraz odpowiedzi głosowej personelu (SC-NUR-11):
 * - AC1: Wskaźnik nieodpowiedzianej wiadomości na kafelku podopiecznego oraz filtr na pulpicie.
 * - AC2: Bezpośrednie przejście z kafelka podopiecznego do wątku wiadomości.
 * - AC3: Przycisk dyktowania odpowiedzi głosowej w oknie konwersacji z transkrypcją do pola tekstowego.
 * - AC4: Zdjęcie wskaźnika po wysłaniu odpowiedzi.
 */

test.describe('Wskaźnik nieodpowiedzianych wiadomości i odpowiedź głosowa (@REQ: NUR-BOARD, @REQ: FAM-MESSAGES, @REQ: INFRA-GROQ-TRANSCRIPTION)', () => {
  test('@REQ: NUR-BOARD - Panel dyżuru personelu prezentuje filtr i wskaźniki oczekujących wiadomości od rodzin', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('nurse');
    const boardPage = new StaffBoardPage(page);
    await boardPage.goto();
    await boardPage.expectStaffBoardLoaded();

    // Weryfikacja obecności dedykowanego filtra oczekujących wiadomości w pasku filtrów
    const messagesFilterToken = page.locator('[data-testid="filter-unanswered-messages"]').first();
    await expect(messagesFilterToken).toBeVisible();

    // Weryfikacja obecności wskaźnika na kafelkach pensjonariuszy z wiadomością od rodziny
    const unansweredBadges = page.locator('[data-testid="unanswered-message-badge"]');
    // Jeżeli placówka posiada wiadomości, wskaźniki powinny być widoczne
    const count = await unansweredBadges.count();
    if (count > 0) {
      await expect(unansweredBadges.first()).toBeVisible();
      // Każdy wskaźnik powinien zawierać link lub prowadzić do wątku wiadomości
      const messageLink = page.locator('a[href^="/staff/messages?residentId="]').first();
      await expect(messageLink).toBeVisible();
    }
  });

  test('@REQ: FAM-MESSAGES - Nawigacja z kafelka podopiecznego bezpośrednio do wątku w skrzynce wiadomości', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('nurse');
    const boardPage = new StaffBoardPage(page);
    await boardPage.goto();
    await boardPage.expectStaffBoardLoaded();

    // Jeśli jest link do wiadomości na kafelku, klikamy w niego
    const messageLink = page.locator('a[href^="/staff/messages?residentId="]').first();
    if (await messageLink.isVisible()) {
      const href = await messageLink.getAttribute('href');
      await messageLink.click();
      await page.waitForURL(`**${href}`);

      const messagesPage = new StaffMessagesPage(page);
      await messagesPage.expectPageLoaded();
      await expect(messagesPage.conversationHeader).toBeVisible();
    }
  });

  test('@REQ: INFRA-GROQ-TRANSCRIPTION - Skrzynka wiadomości oferuje przycisk dyktowania odpowiedzi głosowej i transkrypcję', async ({
    loginPage,
    page,
    context,
  }) => {
    // Uprawnienia do mikrofonu
    await context.grantPermissions(['microphone']);

    // Mock MediaRecorder w przeglądarce
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
            this.ondataavailable({ data: new Blob(['mock-audio-reply'], { type: 'audio/webm' }) });
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
        value: MockMediaRecorder,
      });

      navigator.mediaDevices.getUserMedia = async () => {
        return new MediaStream();
      };
    });

    // Mock endpointu transkrypcji audio
    await page.route('**/api/voice/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          text: 'Pani Helena zjadła dziś cały obiad i czuje się bardzo dobrze.',
          transcript: 'Pani Helena zjadła dziś cały obiad i czuje się bardzo dobrze.',
        }),
      });
    });

    await loginPage.loginAs('nurse');
    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.goto();
    await messagesPage.expectPageLoaded();

    // Sprawdzenie obecności pierwszego wątku
    const threadItems = page.locator('[data-testid="thread-item"]');
    if ((await threadItems.count()) > 0) {
      await threadItems.first().click();

      // Weryfikacja obecności przycisku dyktowania (mikrofonu) przy polu odpowiedzi
      const dictateButton = page.locator('[data-testid="dictate-reply-button"]');
      await expect(dictateButton).toBeVisible();

      // Kliknięcie start nagrywania
      await dictateButton.click();

      // Wskaźnik nagrywania powinien być aktywny
      const recordingIndicator = page.locator('[data-testid="voice-recording-indicator"]');
      await expect(recordingIndicator).toBeVisible();

      // Zatrzymanie nagrywania
      await dictateButton.click();

      // Transkrypcja powinna trafić do pola textarea odpowiedzi
      await expect(messagesPage.replyTextarea).toHaveValue(/Pani Helena zjadła dziś cały obiad/);
    }
  });

  test('@REQ: UI-ACCESSIBILITY - Pole wprowadzania odpowiedzi w skrzynce wiadomości jest widoczne w oknie bez konieczności przewijania strony', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('nurse');
    const messagesPage = new StaffMessagesPage(page);
    await messagesPage.goto();
    await messagesPage.expectPageLoaded();

    const threadItems = page.locator('[data-testid="thread-item"]');
    if ((await threadItems.count()) > 0) {
      await threadItems.first().click();
      await expect(messagesPage.replyTextarea).toBeVisible();

      // Weryfikacja: textarea oraz przycisk wysłania mieszczą się w widocznym oknie przeglądarki (viewport)
      const viewportSize = page.viewportSize();
      const textareaBox = await messagesPage.replyTextarea.boundingBox();
      const sendButtonBox = await messagesPage.sendButton.boundingBox();

      expect(textareaBox).not.toBeNull();
      expect(sendButtonBox).not.toBeNull();
      if (textareaBox && sendButtonBox && viewportSize) {
        expect(textareaBox.y + textareaBox.height).toBeLessThanOrEqual(viewportSize.height);
        expect(sendButtonBox.y + sendButtonBox.height).toBeLessThanOrEqual(viewportSize.height);
      }
    }
  });
});

