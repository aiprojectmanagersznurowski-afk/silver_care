import { randomUUID } from 'node:crypto';
import { createClient } from '../../apps/web/node_modules/@supabase/supabase-js';
import { test, expect } from '../fixtures/base-test';
import { StaffMfaPage } from '../page-objects/StaffMfaPage';

/**
 * @REQ: VOICE-RESIDENT-ASSIGN
 * @REQ: UI-ACCESSIBILITY
 *
 * Przycisk nagrania ogólnego (ikona mikrofonu z tooltipem) dostępny bezpośrednio
 * nad listą podopiecznych w tablicy dyżuru (/staff — tabela oraz szybki obchód)
 * oraz spójnie wyeksponowany na ekranie /voice.
 */
async function withAuthenticatedNurse(
  page: Parameters<typeof test>[1] extends (args: infer A) => unknown ? (A extends { page: infer P } ? P : never) : never,
  loginPage: { goto: () => Promise<void>; login: (email: string, pass: string) => Promise<void> },
  fn: () => Promise<void>
) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!;
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('Tests require local Supabase');
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const org = await admin.from('organizations').insert({ name: 'Test Voice UI' }).select('id').single();
  if (org.error || !org.data) throw new Error('Cannot create test organization');
  const organizationId = org.data.id;

  const email = `nurse-voice-ui-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'nurse', organization_id: organizationId },
  });
  if (error || !created.user) {
    await admin.from('organizations').delete().eq('id', organizationId);
    throw new Error('Cannot create test nurse');
  }

  try {
    await admin.from('residents').insert({
      organization_id: organizationId,
      first_name: 'Helena',
      last_name: 'Testowa',
    });

    const mfa = new StaffMfaPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL(/\/(?:staff|login\/mfa)(?:[/?]|$)/, { timeout: 20000 });
    if (page.url().includes('/login/mfa')) {
      await mfa.enrollTotp();
      await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
    }
    await fn();
  } finally {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from('organizations').delete().eq('id', organizationId);
  }
}

test.describe('Nagranie ogólne — szybki dostęp z tablicy dyżuru i /voice (@REQ: VOICE-RESIDENT-ASSIGN)', () => {
  test('@REQ: VOICE-RESIDENT-ASSIGN @REQ: UI-ACCESSIBILITY - ikona mikrofonu z tooltipem nad podopiecznymi działa w tabeli i w szybkim obchodzie', async ({
    loginPage,
    staffBoardPage,
    page,
  }) => {
    await withAuthenticatedNurse(page, loginPage, async () => {
      await staffBoardPage.goto();
      await staffBoardPage.expectStaffBoardLoaded();

      // Widok domyślny (Tabela): ikona mikrofonu w nagłówku nad listą podopiecznych
      await expect(staffBoardPage.generalVoiceButton).toBeVisible();
      await expect(staffBoardPage.generalVoiceButton.locator('svg.lucide-mic')).toBeVisible();

      const box = await staffBoardPage.generalVoiceButton.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(38);
      expect(box!.height).toBeGreaterThanOrEqual(38);

      await staffBoardPage.generalVoiceButton.hover();
      await expect(page.getByRole('tooltip')).toContainText(/Nagranie ogólne/i);

      // Przełączenie na „Szybki obchód” — przycisk mikrofonu nadal widoczny i prowadzi do /voice/general
      await staffBoardPage.switchToRounds();
      await expect(staffBoardPage.generalVoiceButton).toBeVisible();
      await staffBoardPage.openGeneralRecording();
    });
  });

  test('@REQ: VOICE-RESIDENT-ASSIGN - przycisk nagrania ogólnego na /voice ma ikonę mikrofonu i tooltip', async ({
    loginPage,
    voiceNotePage,
    page,
  }) => {
    await withAuthenticatedNurse(page, loginPage, async () => {
      await voiceNotePage.goto();
      await voiceNotePage.expectResidentSelectionVisible();

      const generalLink = page.getByRole('link', { name: 'Nagranie ogólne' });
      await expect(generalLink).toBeVisible();
      await expect(generalLink.locator('svg.lucide-mic')).toBeVisible();

      await generalLink.hover();
      await expect(page.getByRole('tooltip')).toBeVisible();

      await voiceNotePage.openGeneralRecording();
    });
  });
});
