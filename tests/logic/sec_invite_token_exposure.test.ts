import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatInviteResponse } from '../../apps/web/src/lib/invite-authorization';

/**
 * @REQ: ADM-INVITE
 * @REQ: SEC-NO-PII-LOGS
 *
 * SEC-INVITE-TOKEN-EXPOSURE (Karta Trello #166):
 * Ochrona tokenu zaproszenia rodziny:
 * 1. Token zaproszenia i link rejestracyjny nie mogą być logowane w logach konsoli/serwera.
 * 2. W środowisku produkcyjnym odpowiedź JSON nie ujawnia linku ani identyfikatora tokenu.
 * 3. Dialog zapraszania obsługuje potwierdzenie wysłania maila, gdy link nie jest eksponowany.
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Bezpieczeństwo tokenów zaproszeń rodziny (@REQ: ADM-INVITE, @REQ: SEC-NO-PII-LOGS)', () => {
  it('formatInviteResponse w środowisku produkcyjnym nie ujawnia url ani tokenu @REQ: ADM-INVITE', () => {
    const res = formatInviteResponse({
      invitationId: 'inv-uuid-1234',
      registerUrl: 'https://silvercare.space/register?token=inv-uuid-1234',
      isProduction: true,
      emailSent: true,
    });

    expect(res.success).toBe(true);
    expect(res.emailSent).toBe(true);
    expect(res).not.toHaveProperty('url');
    expect(res).not.toHaveProperty('id');
  });

  it('formatInviteResponse poza produkcją może dołączać url pomocniczy do testów lokalnych @REQ: ADM-INVITE', () => {
    const res = formatInviteResponse({
      invitationId: 'inv-uuid-1234',
      registerUrl: 'https://localhost:3000/register?token=inv-uuid-1234',
      isProduction: false,
      emailSent: false,
    });

    expect(res.success).toBe(true);
    expect(res.emailSent).toBe(false);
    expect(res.url).toBe('https://localhost:3000/register?token=inv-uuid-1234');
    expect(res.id).toBe('inv-uuid-1234');
  });

  it('endpoint /api/family/invite nie loguje linku ani tokenu zaproszenia @REQ: SEC-NO-PII-LOGS', () => {
    const src = read('apps/web/src/app/api/family/invite/route.ts');
    expect(src).not.toMatch(/console\.log\([^)]*registerUrl/);
    expect(src).not.toContain('Link: ${registerUrl}');
    expect(src).not.toMatch(/\[MOCK EMAIL\].*registerUrl/);
  });

  it('endpoint /api/family/invite nie zwraca tokenu bezwarunkowo dla wszystkich środowisk @REQ: ADM-INVITE', () => {
    const src = read('apps/web/src/app/api/family/invite/route.ts');
    expect(src).not.toContain('NextResponse.json({ success: true, url: registerUrl, id: data.id })');
    expect(src).toContain('formatInviteResponse');
  });

  it('komponent InviteFamilyDialog obsługuje potwierdzenie wysłania e-maila bez ujawniania linku @REQ: ADM-INVITE', () => {
    const src = read('apps/web/src/components/InviteFamilyDialog.tsx');
    expect(src).toMatch(/Wiadomość z linkiem|Zaproszenie wysłane|wysłano wiadomość/i);
  });
});
