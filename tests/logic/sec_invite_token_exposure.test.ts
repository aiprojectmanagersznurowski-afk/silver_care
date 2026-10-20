import { describe, it, expect } from 'vitest';
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

  it('odpowiedź formatInviteResponse zapewnia anonimizację i ochronę danych tokenu (SEC-NO-PII-LOGS) @REQ: SEC-NO-PII-LOGS', () => {
    const sensitiveToken = 'super-secret-jwt-token-with-pii';
    const res = formatInviteResponse({
      invitationId: sensitiveToken,
      registerUrl: `https://silvercare.space/register?token=${sensitiveToken}`,
      isProduction: true,
      emailSent: true,
    });

    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain(sensitiveToken);
    expect(serialized).not.toContain('register?token');
  });

  it('komponent InviteFamilyDialog jest poprawnie zdefiniowany i eksportowany @REQ: ADM-INVITE', async () => {
    const dialogModule = await import('../../apps/web/src/components/InviteFamilyDialog');
    expect(typeof dialogModule.InviteFamilyDialog).toBe('function');
  });
});
