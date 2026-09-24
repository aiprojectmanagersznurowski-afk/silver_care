export type TestRole = 'super_admin' | 'org_admin' | 'nurse' | 'family';

export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'SilverTest123!';
export const MAIN_ORG_ID = 'eaf1bc9d-0745-42a7-bf5c-92c657d0fc8b';

export const TEST_USERS: Record<TestRole, { email: string; role: TestRole; organization_id: string }> = {
  super_admin: {
    email: 'e2e.superadmin@silvercare.test',
    role: 'super_admin',
    organization_id: MAIN_ORG_ID,
  },
  org_admin: {
    email: 'e2e.admin@silvercare.test',
    role: 'org_admin',
    organization_id: MAIN_ORG_ID,
  },
  nurse: {
    email: 'e2e.nurse@silvercare.test',
    role: 'nurse',
    organization_id: MAIN_ORG_ID,
  },
  family: {
    email: 'e2e.family@silvercare.test',
    role: 'family',
    organization_id: MAIN_ORG_ID,
  },
};
