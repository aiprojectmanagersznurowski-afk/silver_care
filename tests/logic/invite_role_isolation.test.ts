import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveRelativeRole } from '../../apps/web/src/lib/onboarding';
import { authorizeInviteTarget } from '../../apps/web/src/lib/invite-authorization';

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-ISOLATION
 * @REQ: ADM-INVITE
 *
 * Domknięcie uwag z review PR #44 (FIX-REVIEW-DEBT-PR44-PR47):
 * AC1: legal_guardian zachowuje rolę przy realizacji zaproszenia przez Google OAuth.
 * AC2: zaproszenie bliskiego nie przekracza granicy placówki.
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

describe('Rola bliskiego z zaproszenia (@REQ: CONSENT-GRANTOR)', () => {
  it('mapuje legal_guardian na legal_guardian, a każdą inną wartość na family @REQ: CONSENT-GRANTOR', () => {
    expect(resolveRelativeRole('legal_guardian')).toBe('legal_guardian');
    expect(resolveRelativeRole('family')).toBe('family');
    expect(resolveRelativeRole(null)).toBe('family');
    expect(resolveRelativeRole(undefined)).toBe('family');
    expect(resolveRelativeRole('org_admin')).toBe('family');
    expect(resolveRelativeRole('super_admin')).toBe('family');
  });

  it('callback OAuth nie nadpisuje roli na sztywno i używa roli z zaproszenia @REQ: CONSENT-GRANTOR', () => {
    const src = read('apps/web/src/app/auth/callback/route.ts');
    expect(src).toContain('resolveRelativeRole(invitation.role)');
    expect(src).not.toMatch(/role:\s*'family'/);
    expect(src).not.toMatch(/relationship_code:\s*'family'/);
  });

  it('rejestracja e-mailem i callback OAuth korzystają z tej samej reguły @REQ: CONSENT-GRANTOR', () => {
    const src = read('apps/web/src/app/api/family/register/route.ts');
    expect(src).toContain('resolveRelativeRole(invitation.role)');
  });
});

describe('Granica placówki przy zapraszaniu bliskich (@REQ: ORG-ISOLATION, @REQ: ADM-INVITE)', () => {
  it('org_admin zaprasza do pensjonariusza własnej placówki @REQ: ORG-ISOLATION', () => {
    expect(authorizeInviteTarget({ appRole: 'org_admin', tokenOrgId: ORG_A, residentOrgId: ORG_A }))
      .toEqual({ ok: true, organizationId: ORG_A });
  });

  it('org_admin nie zaprosi do pensjonariusza obcej placówki — 404 jak dla nieistniejącego @REQ: ORG-ISOLATION', () => {
    const foreign = authorizeInviteTarget({ appRole: 'org_admin', tokenOrgId: ORG_A, residentOrgId: ORG_B });
    const missing = authorizeInviteTarget({ appRole: 'org_admin', tokenOrgId: ORG_A, residentOrgId: null });
    expect(foreign).toEqual({ ok: false, status: 404 });
    expect(missing).toEqual(foreign);
  });

  it('rola admin podlega tej samej granicy co org_admin @REQ: ORG-ISOLATION', () => {
    expect(authorizeInviteTarget({ appRole: 'admin', tokenOrgId: ORG_A, residentOrgId: ORG_B }))
      .toEqual({ ok: false, status: 404 });
  });

  it('org_admin bez placówki w tokenie nie dziedziczy placówki z pensjonariusza @REQ: ORG-ISOLATION', () => {
    expect(authorizeInviteTarget({ appRole: 'org_admin', tokenOrgId: null, residentOrgId: ORG_B }))
      .toEqual({ ok: false, status: 404 });
  });

  it('super_admin bez placówki dziedziczy placówkę pensjonariusza, z placówką — musi się zgadzać @REQ: ORG-ISOLATION', () => {
    expect(authorizeInviteTarget({ appRole: 'super_admin', tokenOrgId: null, residentOrgId: ORG_B }))
      .toEqual({ ok: true, organizationId: ORG_B });
    expect(authorizeInviteTarget({ appRole: 'super_admin', tokenOrgId: ORG_A, residentOrgId: ORG_B }))
      .toEqual({ ok: false, status: 404 });
    expect(authorizeInviteTarget({ appRole: 'super_admin', tokenOrgId: null, residentOrgId: null }))
      .toEqual({ ok: false, status: 404 });
  });

  it('endpoint zaproszeń zawsze weryfikuje placówkę pensjonariusza przed zapisem @REQ: ADM-INVITE', () => {
    const src = read('apps/web/src/app/api/family/invite/route.ts');
    expect(src).toContain('authorizeInviteTarget(');
    expect(src).not.toMatch(/if\s*\(\s*!orgId\s*\)\s*\{\s*const\s*\{\s*data:\s*resident\s*\}/);
    expect(src).toContain('resolveRelativeRole(role)');
  });
});
