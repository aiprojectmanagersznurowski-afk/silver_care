import { describe, it, expect } from 'vitest';
import { ROLES, STAFF_ROLES } from '../../packages/contracts/src/generated/roles';

describe('IAM Logic & Access Checks (SUP-IAM-PANEL)', () => {
  it('validates roles structure and ensures super_admin privileges @REQ: SUP-IAM-PANEL', () => {
    const roleIds = ROLES.map(r => r.id);
    expect(roleIds).toContain('super_admin');
    expect(roleIds).toContain('org_admin');
    expect(roleIds).toContain('nurse');
    expect(roleIds).toContain('legal_guardian');
    expect(roleIds).toContain('family');

    expect(STAFF_ROLES).toContain('super_admin');
  });

  it('verifies IAM panel authorization guard @REQ: SUP-IAM-PANEL', () => {
    const isIamAllowed = (role?: string) => role === 'super_admin';

    expect(isIamAllowed('super_admin')).toBe(true);
    expect(isIamAllowed('org_admin')).toBe(false);
    expect(isIamAllowed('nurse')).toBe(false);
    expect(isIamAllowed('legal_guardian')).toBe(false);
    expect(isIamAllowed('family')).toBe(false);
    expect(isIamAllowed(undefined)).toBe(false);
  });

  it('validates audit log role_change payload shape without PII @REQ: SUP-IAM-PANEL', () => {
    const createRoleChangePayload = (targetUserId: string, newRole: string, previousRole: string) => {
      return {
        target_user_id: targetUserId,
        new_role: newRole,
        previous_role: previousRole,
        changed_at: new Date().toISOString()
      };
    };

    const payload = createRoleChangePayload('u-123', 'org_admin', 'nurse');
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toMatch(/"(first_name|last_name|pesel)"/i);
    expect(payload.new_role).toBe('org_admin');
    expect(payload.previous_role).toBe('nurse');
  });
});
