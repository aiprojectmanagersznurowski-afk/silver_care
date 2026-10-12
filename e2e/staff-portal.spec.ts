import { test, expect } from './fixtures/base-test';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

/**
 * @REQ: NUR-BOARD
 * @REQ: REPORT-AI-FEEDBACK
 * @REQ: REPORT-APPROVAL
 * @REQ: MDR-VOCABULARY
 *
 * Testy E2E dla panelu personelu opiekuńczego (Staff Portal) i weryfikacji raportów ze strażnikiem kompletności AI.
 */

test.describe('Portal Personelu (Staff Portal) (@REQ: NUR-BOARD)', () => {
  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do tablicy personelu /staff', async ({ page }) => {
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do dyktafonu personelu /voice', async ({ page }) => {
    await page.goto('/voice');
    await expect(page).toHaveURL(/\/(login)?$/);
  });

  test('@REQ: NUR-BOARD - Niezalogowany użytkownik nie ma dostępu do raportów personelu /staff/reports', async ({ page }) => {
    await page.goto('/staff/reports');
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});

test.describe('Weryfikacja raportów i Strażnik Kompletności AI (@REQ: REPORT-AI-FEEDBACK, @REQ: REPORT-APPROVAL, @REQ: MDR-VOCABULARY)', () => {
  let sql: any;
  let testResidentId: string;
  let testAuthorId: string;
  let createdReportId: string | null = null;

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });
    // Pobierz istniejącego pensjonariusza głównej placówki
    const residents = await sql`SELECT id FROM public.residents WHERE organization_id = '9d9b1de9-8f38-48c8-8b5b-721901fed8ff' LIMIT 1`;
    testResidentId = residents[0].id;

    // Pobierz identyfikator pielęgniarki
    const nurses = await sql`SELECT id FROM auth.users WHERE email = 'e2e.nurse@silvercare.test' LIMIT 1`;
    testAuthorId = nurses[0].id;
  });

  test.afterAll(async () => {
    if (sql) {
      if (createdReportId) {
        await sql`DELETE FROM public.daily_reports WHERE id = ${createdReportId}`;
      }
      await sql.end();
    }
  });

  test('@REQ: REPORT-AI-FEEDBACK @REQ: REPORT-APPROVAL @REQ: MDR-VOCABULARY - Pielęgniarka weryfikuje szkic raportu ze wskaźnikiem kompletności AI i publikuje go dla rodziny', async ({
    loginPage,
    staffReportsPage,
    page,
  }) => {
    // Wstawienie testowego szkicu raportu (zawiera posiłki i aktywność, ale brakuje nastroju i snu)
    const partialText = 'Pan Stanisław zjadł dziś pełne śniadanie i obiad z apetytem. Po południu spacerował po ogrodzie z opiekunem.';
    const [insertedReport] = await sql`
      INSERT INTO public.daily_reports (
        resident_id,
        author_id,
        status,
        content
      ) VALUES (
        ${testResidentId},
        ${testAuthorId},
        'DRAFT',
        ${sql.json({ text: partialText })}
      )
      RETURNING id;
    `;
    createdReportId = insertedReport.id;

    // 1. Logowanie jako pielęgniarka
    await loginPage.loginAs('nurse');

    // 2. Przejście do widoku raportów do weryfikacji
    await staffReportsPage.goto();
    await staffReportsPage.expectPageLoaded();

    // 3. Weryfikacja obecności karty raportu
    await expect(staffReportsPage.reportCards.first()).toBeVisible();
    await expect(staffReportsPage.draftStatusBadge.first()).toBeVisible();
    await expect(staffReportsPage.reportContentText.first()).toContainText('śniadanie');

    // 4. Weryfikacja strażnika kompletności (@REQ: REPORT-AI-FEEDBACK):
    //    - Wynik procentowy (50% dla 2/4 wymiarów)
    //    - Wyświetlenie wymiarów (posiłki i aktywność jako pokryte)
    //    - Wyświetlenie podpowiedzi asystenta (nudge) o brakujących obszarach
    await expect(staffReportsPage.completenessGate.first()).toBeVisible();
    await expect(staffReportsPage.completenessScore.first()).toContainText('50%');

    const mealsPill = await staffReportsPage.getDimensionPill('meals');
    const moodPill = await staffReportsPage.getDimensionPill('mood');
    const activityPill = await staffReportsPage.getDimensionPill('activity');
    const restPill = await staffReportsPage.getDimensionPill('rest');

    await expect(mealsPill.first()).toBeVisible();
    await expect(moodPill.first()).toBeVisible();
    await expect(activityPill.first()).toBeVisible();
    await expect(restPill.first()).toBeVisible();
    await expect(staffReportsPage.completenessSuggestion.first()).toBeVisible();

    // 5. Autonomia personelu (@REQ: REPORT-APPROVAL):
    //    Przycisk publikacji NIE JEST zablokowany pomimo braku wszystkich wymiarów
    await expect(staffReportsPage.publishReportButton.first()).toBeEnabled();

    // 6. Słownik MDR (@REQ: MDR-VOCABULARY):
    //    Brak słowa "pacjent" na widoku raportu
    const pageText = await page.innerText('body');
    expect(pageText).not.toMatch(/pacjent/i);

    // 7. Edycja szkicu przez pielęgniarkę:
    await staffReportsPage.editReportButton.first().click();
    await expect(staffReportsPage.contentTextarea.first()).toBeVisible();

    const additionalText = ' Pan Stanisław miał znakomity humor, był spokojny i uśmiechnięty.';
    await staffReportsPage.contentTextarea.first().fill(partialText + additionalText);
    await staffReportsPage.saveReportButton.first().click();

    // Po zapisie wskaźnik kompletności rośnie (75% - 3/4 wymiary)
    await expect(staffReportsPage.completenessScore.first()).toContainText('75%');

    // 8. Zatwierdzenie i publikacja raportu dla rodziny (@REQ: REPORT-APPROVAL)
    await staffReportsPage.publishReportButton.first().click();

    // Na widoku głównym szkiców (/staff/reports) opublikowany raport znika z listy oczekujących na weryfikację
    await expect(staffReportsPage.reportCards).toHaveCount(0);

    // W widoku historii podopiecznego (/staff/reports?resident=...) opublikowany raport posiada badge 'Opublikowany dla rodziny'
    await staffReportsPage.goto(testResidentId);
    await expect(staffReportsPage.publishedStatusBadge.first()).toBeVisible();
  });
});
