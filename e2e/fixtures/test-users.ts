export type TestRole = 'super_admin' | 'org_admin' | 'nurse' | 'family';

export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'SilverTest123!';
export const MAIN_ORG_ID = process.env.E2E_MAIN_ORG_ID || '9d9b1de9-8f38-48c8-8b5b-721901fed8ff';

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
