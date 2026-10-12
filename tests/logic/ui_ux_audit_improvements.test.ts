import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy weryfikujące wdrożenie ustaleń z audytów UI/UX (UI/Audyt):
 * 1. Ekran logowania (silvercare-login-audit.md): semantyka, autocomplete, brak mylących placeholderów, cel dotykowy, ikona Google, odzyskiwanie hasła.
 * 2. Portal rodziny (silver-care-audyt-portal-rodziny.md): responsywność nagłówka 768px-935px, przestrzeń composera wiadomości.
 * 3. Panel placówki (silver-care-audyt-panel-admina.md): flex-wrap paska akcji w strukturze, deduplikacja prefiksu sektora.
 * 4. Super Admin / IAM (audyt-ui-silver-care-super-admin.md): responsywne kafelki placówek, polskie etykiety ról i BusinessId w IAM.
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Wdrożenie audytów UI/UX (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  describe('1. Ekran logowania (/login)', () => {
    it('posiada semantyczny kontener <main> i nagłówek h1 @REQ: UI-ACCESSIBILITY', () => {
      const src = read('apps/web/src/app/login/page.tsx');
      expect(src).toMatch(/<main\b/);
      expect(src).toMatch(/<h1\b/);
    });

    it('inputy posiadają atrybuty autocomplete i name oraz usunięty mylący placeholder hasła @REQ: UI-ACCESSIBILITY', () => {
      const src = read('apps/web/src/app/login/page.tsx');
      expect(src).toContain('autoComplete="username"');
      expect(src).toContain('autoComplete="current-password"');
      expect(src).toContain('name="email"');
      expect(src).toContain('name="password"');
      expect(src).not.toContain('placeholder="••••••••"');
    });

    it('zawiera link odzyskiwania hasła oraz ikonę Google @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const src = read('apps/web/src/app/login/page.tsx');
      expect(src).toMatch(/Nie pamiętasz hasła\?/);
      expect(src).toMatch(/<a\s+[^>]*href=/);
      expect(src).toMatch(/GoogleIcon|svg.*viewBox/i);
    });
  });

  describe('2. Portal rodziny', () => {
    it('FamilyHeader włącza nawigację desktopową od lg i zabezpiecza linki przed zawijaniem @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const src = read('apps/web/src/components/FamilyHeader.tsx');
      expect(src).toContain('lg:flex');
      expect(src).toContain('whitespace-nowrap');
    });
  });

  describe('3. Panel placówki', () => {
    it('nagłówek struktury w /admin/facility używa flex-wrap dla przycisków akcji @REQ: UI-ACCESSIBILITY', () => {
      const src = read('apps/web/src/app/(admin)/admin/facility/page.tsx');
      expect(src).toMatch(/flex\s+flex-wrap\s+items-center\s+gap-2/);
    });

    it('RoomList deduplikuje prefiks Sektor w nazwach @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const src = read('apps/web/src/components/facility/RoomList.tsx');
      expect(src).toMatch(/formatSectorName|startsWith\(['"]sektor/i);
    });
  });

  describe('4. Super Admin i IAM', () => {
    it('kafelki placówek w OrganizationsManagementClient posiadają responsywny nagłówek @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const src = read('apps/web/src/components/OrganizationsManagementClient.tsx');
      expect(src).toContain('min-w-0 flex-1');
      expect(src).toContain('shrink-0');
    });

    it('tabela IAM wyświetla czytelne polskie etykiety ról i ma zabezpieczoną szerokość selecta @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const src = read('apps/web/src/components/iam/UserTable.tsx');
      expect(src).toMatch(/roleLabel|availableRoles\.find/);
      expect(src).toContain('min-w-');
    });
  });
});
