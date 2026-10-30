import { test, expect } from './fixtures/base-test';
import { FamilyOffboardingPage } from './page-objects/FamilyOffboardingPage';
import { FamilyDashboardPage } from './page-objects/FamilyDashboardPage';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: ADM-ARCHIVE
 * @REQ: SEC-RETENTION
 *
 * Testy E2E dla widoku pożegnalnego, pobierania archiwum pobytu, 30-dniowego okna retencji
 * oraz izolacji zgłoszenia zgonu oczekującego na zatwierdzenie (SC-FAM-07).
 */
test.describe('Portal rodziny — widok po zgonie/wypisie i okno retencji (SC-FAM-07)', () => {
  let sql: any;
  let deceasedResidentId: string;
  let dischargedResidentId: string;
  let expiredResidentId: string;
  let pendingDeathResidentId: string;

  test.beforeAll(async () => {
    sql = postgres(dbUrl!, { prepare: false });

    const familyUsers = await sql`
      SELECT id, raw_app_meta_data->>'organization_id' as org_id
      FROM auth.users
      WHERE email = 'e2e.family@silvercare.test'
      LIMIT 1
    `;
    const familyUserId = familyUsers[0].id;
    const orgId = familyUsers[0].org_id;

    const nurses = await sql`SELECT id FROM auth.users WHERE email = 'e2e.nurse@silvercare.test' LIMIT 1`;
    const nurseAuthorId = nurses[0].id;

    // 1. Podopieczny zmarły (deceased) w oknie retencji (np. 5 dni temu)
    const deceased = await sql`
      INSERT INTO public.residents (
        organization_id, first_name, last_name, pesel_hash, death_date, contract_end_date
      ) VALUES (
        ${orgId}, ${'Zofia'}, ${'Zmarla'}, ${'hash_e2e_offb_deceased'}, '2026-10-25', '2026-10-25'
      ) RETURNING id;
    `;
    deceasedResidentId = deceased[0].id;

    // Dodajemy opublikowany raport dla podopiecznego zmarłego
    await sql`
      INSERT INTO public.daily_reports (
        resident_id, author_id, status, content
      ) VALUES (
        ${deceasedResidentId}, ${nurseAuthorId}, 'PUBLISHED',
        ${JSON.stringify({ text: 'Pani Zofia spędziła spokojny poranek w ogrodzie.', metrics: { steps: 2100, sleep_hours: 8 } })}
      );
    `;

    // 2. Podopieczny wypisany (discharged) w oknie retencji (np. 10 dni temu)
    const discharged = await sql`
      INSERT INTO public.residents (
        organization_id, first_name, last_name, pesel_hash, contract_end_date
      ) VALUES (
        ${orgId}, ${'Tadeusz'}, ${'Wypisany'}, ${'hash_e2e_offb_discharged'}, '2026-10-20'
      ) RETURNING id;
    `;
    dischargedResidentId = discharged[0].id;

    await sql`
      INSERT INTO public.daily_reports (
        resident_id, author_id, status, content
      ) VALUES (
        ${dischargedResidentId}, ${nurseAuthorId}, 'PUBLISHED',
        ${JSON.stringify({ text: 'Pan Tadeusz uczestniczył w pożegnalnym spotkaniu z personelem.', metrics: { steps: 1800, sleep_hours: 7.5 } })}
      );
    `;

    // 3. Podopieczny po upływie retencji (zakończony pobyt 45 dni temu)
    const expired = await sql`
      INSERT INTO public.residents (
        organization_id, first_name, last_name, pesel_hash, contract_end_date
      ) VALUES (
        ${orgId}, ${'Stanisław'}, ${'Wygasly'}, ${'hash_e2e_offb_expired'}, '2026-09-10'
      ) RETURNING id;
    `;
    expiredResidentId = expired[0].id;

    // 4. Podopieczny ze zgłoszeniem zgonu z #163 oczekujący na zatwierdzenie kierownika
    const pending = await sql`
      INSERT INTO public.residents (
        organization_id, first_name, last_name, pesel_hash, death_reported_at
      ) VALUES (
        ${orgId}, ${'Marian'}, ${'Oczekujacy'}, ${'hash_e2e_offb_pending'}, now()
      ) RETURNING id;
    `;
    pendingDeathResidentId = pending[0].id;

    // Powiązanie wszystkich 4 pensjonariuszy z kontem e2e.family
    await sql`
      INSERT INTO public.resident_relative_links (
        resident_id, relative_user_id, relationship_code, role
      ) VALUES
        (${deceasedResidentId}, ${familyUserId}, 'Córka / Syn', 'family'),
        (${dischargedResidentId}, ${familyUserId}, 'Córka / Syn', 'family'),
        (${expiredResidentId}, ${familyUserId}, 'Córka / Syn', 'family'),
        (${pendingDeathResidentId}, ${familyUserId}, 'Córka / Syn', 'family');
    `;
  });

  test.afterAll(async () => {
    if (sql) {
      const ids = [deceasedResidentId, dischargedResidentId, expiredResidentId, pendingDeathResidentId].filter(Boolean);
      if (ids.length > 0) {
        await sql`
          DELETE FROM public.residents
          WHERE id IN ${sql(ids)};
        `;
      }
      await sql.end();
    }
  });

  test('@REQ: FAM-DASHBOARD - podopieczny zmarły (deceased): widok memorial_window z odliczaniem i archiwum pamiątkowym', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('family');
    const familyDashboard = new FamilyDashboardPage(page);
    await familyDashboard.dismissOnboardingModalIfExists();

    const offboarding = new FamilyOffboardingPage(page);
    await offboarding.selectResidentCookie(deceasedResidentId);
    await offboarding.goto();

    // Wyciszony widok po zgonie
    await offboarding.expectMemorialWindowVisible({ isDeceased: true });
    await expect(page.locator('text=Pamięci podopiecznego')).toBeVisible();

    // Pobranie archiwum pamiątkowego
    const archive = await offboarding.downloadArchive();
    expect(archive.fileName).toMatch(/^archiwum-pamiatkowe-.*\.txt$/);
    expect(archive.content).toContain('SILVER CARE — PAMIĄTKOWE ARCHIWUM POBYTU PODOPIECZNEGO');
    expect(archive.content).toContain('Zofia');
    expect(archive.content.toLowerCase()).not.toMatch(/pacjent/);
  });

  test('@REQ: ADM-ARCHIVE - podopieczny wypisany (discharged): archiwum raportów z pobytu bez słowa pamiątkowe', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('family');
    const familyDashboard = new FamilyDashboardPage(page);
    await familyDashboard.dismissOnboardingModalIfExists();

    const offboarding = new FamilyOffboardingPage(page);
    await offboarding.selectResidentCookie(dischargedResidentId);
    await offboarding.goto();

    // Widok po wypisie
    await offboarding.expectMemorialWindowVisible({ isDeceased: false });
    await expect(page.locator('text=Zakończony pobyt')).toBeVisible();

    // Pobranie archiwum raportów z pobytu
    const archive = await offboarding.downloadArchive();
    expect(archive.fileName).toMatch(/^archiwum-pobytu-.*\.txt$/);
    expect(archive.content).toContain('SILVER CARE — ARCHIWUM RAPORTÓW Z POBYTU PODOPIECZNEGO');
    expect(archive.content).not.toContain('PAMIĄTKOWE');
    expect(archive.content).toContain('Tadeusz');
    expect(archive.content.toLowerCase()).not.toMatch(/pacjent/);
  });

  test('@REQ: SEC-RETENTION - po upływie 30 dni dostęp wygasa i blokuje wejście na /agenda i /messages', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('family');
    const familyDashboard = new FamilyDashboardPage(page);
    await familyDashboard.dismissOnboardingModalIfExists();

    const offboarding = new FamilyOffboardingPage(page);
    await offboarding.selectResidentCookie(expiredResidentId);
    await offboarding.goto();

    // Komunikat o wygaśnięciu okresu retencji
    await offboarding.expectRetentionExpiredVisible();

    // Próba wejścia na /agenda jest przekierowywana do /dashboard
    await page.goto('/agenda').catch(() => {});
    await page.waitForURL('**/dashboard');
    await offboarding.expectRetentionExpiredVisible();

    // Próba wejścia na /messages jest przekierowywana do /dashboard
    await page.goto('/messages').catch(() => {});
    await page.waitForURL('**/dashboard');
    await offboarding.expectRetentionExpiredVisible();
  });

  test('@REQ: FAM-DASHBOARD - zgłoszenie zgonu ze statusem roboczym (#163) nie przełącza portalu bliskich w tryb po zgonie', async ({
    loginPage,
    page,
  }) => {
    await loginPage.loginAs('family');
    const familyDashboard = new FamilyDashboardPage(page);
    await familyDashboard.dismissOnboardingModalIfExists();

    const offboarding = new FamilyOffboardingPage(page);
    await offboarding.selectResidentCookie(pendingDeathResidentId);
    await offboarding.goto();

    // Rodzina widzi standardowy aktywny pulpit podopiecznego, a nie widok po zgonie
    await expect(page.locator('[data-testid="download-memorial-archive-btn"]')).not.toBeVisible();
    await expect(page.locator('h1:has-text("Okres retencji dostępu wygasł")')).not.toBeVisible();
    await expect(page.locator('text=Pamięci podopiecznego')).not.toBeVisible();
  });
});
