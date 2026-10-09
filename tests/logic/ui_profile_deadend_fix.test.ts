import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * UI-PROFILE-DEADEND-FIX (Karta Trello #175):
 * Likwidacja ślepego zaułka i wpięcie nawigacji do profilu:
 * 1. Pasek boczny personelu i administratora (SidebarAccount) posiada link do /settings/profile.
 * 2. Menu nagłówka rodziny (FamilyHeader) posiada link do /settings/profile.
 * 3. Strona /settings/profile posiada wyraźny przycisk powrotu do odpowiedniego panelu użytkownika.
 * 4. Sekcja MFA zawiera czytelną etykietę "Planowane w kolejnym wydaniu".
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Likwidacja ślepego zaułka profilu (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  it('SidebarAccount zawiera link do profilu użytkownika @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const src = read('apps/web/src/components/SidebarAccount.tsx');
    expect(src).toContain('/settings/profile');
    expect(src).toMatch(/Profil i bezpieczeństwo|Profil/);
  });

  it('FamilyHeader zawiera pozycję menu prowadzącą do /settings/profile @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const src = read('apps/web/src/components/FamilyHeader.tsx');
    expect(src).toContain('/settings/profile');
    expect(src).toMatch(/Profil i bezpieczeństwo|Profil/);
  });

  it('strona profilu posiada przycisk powrotu do panelu @REQ: UI-ACCESSIBILITY', () => {
    const pageSrc = read('apps/web/src/app/settings/profile/page.tsx');
    const clientSrc = read('apps/web/src/app/settings/profile/profile-client.tsx');
    const combined = `${pageSrc}\n${clientSrc}`;

    expect(combined).toMatch(/Wróć do panelu|Wróć|Powrót/);
    expect(combined).toMatch(/ArrowLeft/);
  });

  it('sekcja MFA posiada oznaczenie planowanego wdrożenia @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const src = read('apps/web/src/app/settings/profile/profile-client.tsx');
    expect(src).toMatch(/Planowane w kolejnym wydaniu/i);
  });
});
