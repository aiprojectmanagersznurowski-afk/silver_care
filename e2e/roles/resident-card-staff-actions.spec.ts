import postgres from 'postgres';
import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';
import { TEST_USERS } from '../fixtures/test-users';

/**
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 * @REQ: VOICE-ZERO-GUESSING
 *
 * Karta podopiecznego dla personelu (SC-ADM-20):
 * - status ZSN wynika z dokumentacji przyjęcia, więc pielęgniarka widzi go tylko do odczytu, a zmienia kierownik placówki;
 * - uwagi wpisane przy przyjęciu mają tę samą nazwę co w kreatorze przyjęcia („Uwagi przyjęciowe”);
 * - z karty można od razu nagrać notatkę głosową o tym podopiecznym (identyfikator z UI, model go nie zgaduje).
 */
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test.describe('Karta podopiecznego — działania personelu (@REQ: ADM-RESIDENT-CARD-VISIBILITY)', () => {
  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - pielęgniarka widzi status ZSN tylko do odczytu', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    await card.openStaffCard(await card.firstResidentIdFromStaffBoard());
    await expect(card.tab('Przegląd')).toBeVisible();

    await expect(card.zsnValue).toHaveText(/^(Tak|Nie)$/);
    await expect(card.zsnToggle).toHaveCount(0);
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - kierownik placówki nadal zmienia status ZSN na karcie', async ({ loginPage, page }) => {
    // Identyfikator z bazy zamiast klikania w tabelę listy (na telefonie lista ma inny układ)
    const sql = postgres(dbUrl!, { prepare: false });
    const [r] = await sql`SELECT r.id::text AS id FROM public.residents r JOIN auth.users u
      ON u.raw_app_meta_data->>'organization_id' = r.organization_id::text AND u.email = ${TEST_USERS.org_admin.email}
      WHERE r.archived_at IS NULL ORDER BY r.last_name LIMIT 1`;
    await sql.end();

    await loginPage.loginAs('org_admin');
    const card = new ResidentProfilePage(page);
    await card.openAdminCard(r.id);
    await expect(card.zsnToggle).toBeVisible();
    await expect(card.zsnValue).toHaveCount(0);
  });

  test('@REQ: ADM-RESIDENT-CARD-VISIBILITY - uwagi z przyjęcia mają na karcie etykietę „Uwagi przyjęciowe”', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    const id = await card.firstResidentIdFromStaffBoard();

    const sql = postgres(dbUrl!, { prepare: false });
    const [before] = await sql`SELECT notes FROM public.residents WHERE id = ${id}`;
    try {
      await sql`UPDATE public.residents SET notes = ${'E2E uwagi z przyjęcia'} WHERE id = ${id}`;
      await card.openStaffCard(id);
      await expect(page.locator('main').getByText('Uwagi przyjęciowe', { exact: true })).toBeVisible();
      await expect(page.locator('main').getByText('E2E uwagi z przyjęcia')).toBeVisible();
      await expect(page.locator('main').getByText('Uwagi opiekuńcze')).toHaveCount(0);
    } finally {
      await sql`UPDATE public.residents SET notes = ${before.notes} WHERE id = ${id}`;
      await sql.end();
    }
  });

  test('@REQ: VOICE-ZERO-GUESSING - pielęgniarka nagrywa notatkę głosową prosto z karty, z wybranym podopiecznym', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    const id = await card.firstResidentIdFromStaffBoard();
    await card.openStaffCard(id);

    await expect(card.voiceNoteLink).toHaveAttribute('href', `/voice?resident=${id}`);
    await card.voiceNoteLink.click();
    await page.waitForURL(new RegExp(`/voice\\?resident=${id}`));
  });
});
