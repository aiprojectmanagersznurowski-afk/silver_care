import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findUserByEmail,
  evaluateAdminAssignment,
  AdminAssignmentInput,
} from '../../apps/web/src/lib/admin-assign-safety';

/**
 * @REQ: ORG-PROVISION
 * @REQ: SUP-IAM-PANEL
 * @REQ: ORG-ISOLATION
 *
 * Karta #168: ORG-ASSIGN-ADMIN-SAFETY
 * Bezpieczne przypisanie administratora placówki i paginacja użytkowników
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

describe('Bezpieczne przypisanie administratora placówki (@REQ: ORG-PROVISION, @REQ: SUP-IAM-PANEL, @REQ: ORG-ISOLATION)', () => {
  describe('Paginowane wyszukiwanie użytkownika (findUserByEmail) @REQ: ORG-PROVISION', () => {
    it('znajduje użytkownika znajdującego się na dalszej stronie (strona 3) przy użyciu paginacji', async () => {
      const mockListUsers = vi.fn().mockImplementation(({ page, perPage }) => {
        if (page === 1) {
          return Promise.resolve({
            data: { users: Array.from({ length: 50 }, (_, i) => ({ id: `u1_${i}`, email: `user1_${i}@example.com` })) },
            error: null,
          });
        }
        if (page === 2) {
          return Promise.resolve({
            data: { users: Array.from({ length: 50 }, (_, i) => ({ id: `u2_${i}`, email: `user2_${i}@example.com` })) },
            error: null,
          });
        }
        if (page === 3) {
          return Promise.resolve({
            data: {
              users: [
                { id: 'target_user_id', email: 'admin.target@silvercare.space' },
                { id: 'u3_1', email: 'user3_1@example.com' },
              ],
            },
            error: null,
          });
        }
        return Promise.resolve({ data: { users: [] }, error: null });
      });

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mockListUsers,
          },
        },
      };

      const result = await findUserByEmail(mockAdminClient as any, 'Admin.Target@silvercare.space ');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('target_user_id');
      expect(mockListUsers).toHaveBeenCalledTimes(3);
    });

    it('zwraca null i zatrzymuje pętlę, gdy użytkownik nie istnieje', async () => {
      const mockListUsers = vi.fn().mockResolvedValue({
        data: { users: [{ id: 'u1', email: 'other@example.com' }] },
        error: null,
      });

      const mockAdminClient = {
        auth: {
          admin: {
            listUsers: mockListUsers,
          },
        },
      };

      const result = await findUserByEmail(mockAdminClient as any, 'nonexistent@example.com');
      expect(result).toBeNull();
      expect(mockListUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('Walidacja bezpieczeństwa roli (evaluateAdminAssignment) @REQ: SUP-IAM-PANEL, @REQ: ORG-ISOLATION', () => {
    it('blokuje degradację operatora platformy super_admin do roli org_admin (fail-closed) @REQ: SUP-IAM-PANEL', () => {
      const input: AdminAssignmentInput = {
        existingUser: {
          id: 'admin_id',
          email: 'operator@silvercare.space',
          app_metadata: { role: 'super_admin' },
        },
        targetOrgId: ORG_A,
      };

      const decision = evaluateAdminAssignment(input);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.errorCode).toBe('SUPER_ADMIN_CONFLICT');
        expect(decision.error).toContain('super_admin');
      }
    });

    it('blokuje przypisanie administratora innej placówki do nowej placówki @REQ: ORG-ISOLATION', () => {
      const input: AdminAssignmentInput = {
        existingUser: {
          id: 'admin_id',
          email: 'admin.b@silvercare.space',
          app_metadata: { role: 'org_admin', organization_id: ORG_B },
        },
        targetOrgId: ORG_A,
      };

      const decision = evaluateAdminAssignment(input);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.errorCode).toBe('ORGANIZATION_MISMATCH');
        expect(decision.error).toContain('innej');
      }
    });

    it('pozwala na utworzenie administratora dla nowego konta @REQ: ORG-PROVISION', () => {
      const input: AdminAssignmentInput = {
        existingUser: null,
        targetOrgId: ORG_A,
      };

      const decision = evaluateAdminAssignment(input);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.isExistingUser).toBe(false);
      }
    });

    it('pozwala na przypisanie administratora dla konta bez przypisanej placówki @REQ: ORG-PROVISION', () => {
      const input: AdminAssignmentInput = {
        existingUser: {
          id: 'new_staff_id',
          email: 'new.admin@silvercare.space',
          app_metadata: {},
        },
        targetOrgId: ORG_A,
      };

      const decision = evaluateAdminAssignment(input);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.isExistingUser).toBe(true);
      }
    });
  });

  describe('Integracja w actions/organizations.ts @REQ: ORG-PROVISION, @REQ: SUP-IAM-PANEL', () => {
    it('akcja addAdminToOrganizationAction używa findUserByEmail i evaluateAdminAssignment @REQ: SUP-IAM-PANEL', () => {
      const src = read('apps/web/src/actions/organizations.ts');
      expect(src).toContain('findUserByEmail');
      expect(src).toContain('evaluateAdminAssignment');
      // Nie może być wywołania listUsers() bez paginacji w addAdminToOrganizationAction
      const actionBody = src.slice(src.indexOf('export async function addAdminToOrganizationAction'));
      expect(actionBody).not.toMatch(/adminClient\.auth\.admin\.listUsers\s*\(\s*\)/);
    });
  });
});
