import { describe, it, expect } from 'vitest';
import { NOTIFICATIONS } from '../../packages/contracts/src/generated/notifications';
import { CAPACITY_POLICY } from '../../packages/contracts/src/generated/facility';
import { renderCapacityExceededEmail, selectCapacityRecipients } from '../../apps/web/src/lib/capacity-notifications';

/**
 * @REQ: ADM-CAPACITY-LIMIT
 *
 * Powiadomienia A4 (kierownik placówki) i A5 (super admin) o przekroczeniu limitu miejsc:
 * odbiorcy z katalogu powiadomień, treść z liczbami i bez danych podopiecznych (NTF-NO-PII).
 */
const ORG = '30f10f0c-8343-4228-8ce8-6f52b8314df0';
const OTHER_ORG = '9d9b1de9-8f38-48c8-8b5b-721901fed8ff';
const users = [
  { id: 'u1', email: 'kier@placowka.test', app_metadata: { role: 'org_admin', organization_id: ORG } },
  { id: 'u2', email: 'kier@inna.test', app_metadata: { role: 'org_admin', organization_id: OTHER_ORG } },
  { id: 'u3', email: 'super@platforma.test', app_metadata: { role: 'super_admin' } },
  { id: 'u4', email: 'opiekun@placowka.test', app_metadata: { role: 'nurse', organization_id: ORG } },
  { id: 'u5', email: 'bez-maila', app_metadata: { role: 'super_admin' } },
  { id: 'u6', email: 'udaje@placowka.test', app_metadata: {}, user_metadata: { role: 'super_admin' } },
];

describe('Powiadomienia o przekroczeniu limitu miejsc (ADM-CAPACITY-LIMIT)', () => {
  it('@REQ: ADM-CAPACITY-LIMIT - kontrakt wskazuje A4 i A5 jako powiadomienia przekroczenia', () => {
    expect(CAPACITY_POLICY.onExceed.notify).toEqual(['A4', 'A5']);
    expect(NOTIFICATIONS.find((n) => n.id === 'A4')?.recipient).toBe('ORG_ADMIN');
    expect(NOTIFICATIONS.find((n) => n.id === 'A5')?.recipient).toBe('SUPER_ADMIN');
  });

  it('@REQ: ADM-CAPACITY-LIMIT - A4 trafia tylko do kierowników tej placówki, A5 tylko do super adminów (rola z app_metadata)', () => {
    expect(selectCapacityRecipients(users, { notificationId: 'A4', organizationId: ORG })).toEqual(['kier@placowka.test']);
    expect(selectCapacityRecipients(users, { notificationId: 'A5', organizationId: ORG })).toEqual(['super@platforma.test']);
    expect(() => selectCapacityRecipients(users, { notificationId: 'F1' as never, organizationId: ORG })).toThrow();
  });

  it('@REQ: ADM-CAPACITY-LIMIT - treść z liczbami, różna dla kierownika i super admina, bez danych podopiecznych', () => {
    const facts = { residentLimit: 50, projected: 53, excess: 3, counts: 'beds' as const, portalUrl: 'https://silver-care-six.vercel.app/login' };
    const a4 = renderCapacityExceededEmail({ ...facts, notificationId: 'A4' });
    const a5 = renderCapacityExceededEmail({ ...facts, notificationId: 'A5', organizationName: 'Dom pod Lipami' });

    for (const t of [a4, a5]) {
      expect(t.text).toContain('53');
      expect(t.text).toContain('50');
      expect(t.subject).toMatch(/limit miejsc/i);
      expect(t.text + t.html).not.toMatch(/pensjonariusz|ośrod|pojemno|pesel/i);
    }
    expect(a5.text).toContain('Dom pod Lipami');
    expect(a4.subject).not.toBe(a5.subject);
  });
});
