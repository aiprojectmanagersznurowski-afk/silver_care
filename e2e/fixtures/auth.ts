import { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  role: 'family' | 'legal_guardian' | 'nurse' | 'caregiver' | 'admin' | 'org_admin' | 'super_admin';
}

/**
 * Pomocnik do symulowania stanów autentykacji w testach E2E Playwright.
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Mockuje odpowiedź Supabase Auth dla logowania hasłem na poziomie przeglądarki.
   */
  async mockSignInResponse(options: { success: boolean; user?: MockUser; errorStatus?: number; errorMessage?: string }) {
    await this.page.route('**/auth/v1/token?grant_type=password', async (route) => {
      if (!options.success) {
        await route.fulfill({
          status: options.errorStatus || 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: options.errorMessage || 'Invalid login credentials',
          }),
        });
      } else {
        const user = options.user || {
          id: 'usr_mock_1',
          email: 'test@example.com',
          role: 'family',
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'tok_test',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'ref_test',
            user: {
              id: user.id,
              email: user.email,
              app_metadata: { role: user.role, provider: 'email' },
              user_metadata: { role: user.role },
            },
          }),
        });
      }
    });
  }
}
