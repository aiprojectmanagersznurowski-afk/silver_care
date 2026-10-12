import { test as baseTest } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { AcceptInvitePage } from '../page-objects/AcceptInvitePage';
import { UnauthorizedPage } from '../page-objects/UnauthorizedPage';
import { FamilyDashboardPage } from '../page-objects/FamilyDashboardPage';
import { StaffBoardPage } from '../page-objects/StaffBoardPage';
import { StaffReportsPage } from '../page-objects/StaffReportsPage';
import { AdminDashboardPage } from '../page-objects/AdminDashboardPage';
import { VoiceNotePage } from '../page-objects/VoiceNotePage';
import { AuthHelper } from './auth';

type TestFixtures = {
  loginPage: LoginPage;
  acceptInvitePage: AcceptInvitePage;
  unauthorizedPage: UnauthorizedPage;
  familyDashboardPage: FamilyDashboardPage;
  staffBoardPage: StaffBoardPage;
  staffReportsPage: StaffReportsPage;
  adminDashboardPage: AdminDashboardPage;
  voiceNotePage: VoiceNotePage;
  authHelper: AuthHelper;
};

export const test = baseTest.extend<TestFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  acceptInvitePage: async ({ page }, use) => {
    await use(new AcceptInvitePage(page));
  },
  unauthorizedPage: async ({ page }, use) => {
    await use(new UnauthorizedPage(page));
  },
  familyDashboardPage: async ({ page }, use) => {
    await use(new FamilyDashboardPage(page));
  },
  staffBoardPage: async ({ page }, use) => {
    await use(new StaffBoardPage(page));
  },
  staffReportsPage: async ({ page }, use) => {
    await use(new StaffReportsPage(page));
  },
  adminDashboardPage: async ({ page }, use) => {
    await use(new AdminDashboardPage(page));
  },
  voiceNotePage: async ({ page }, use) => {
    await use(new VoiceNotePage(page));
  },
  authHelper: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },
});

export { expect } from '@playwright/test';
