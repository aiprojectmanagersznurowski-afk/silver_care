import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { middleware, config } from '../../apps/web/src/middleware';
import { resolveRoleDestination } from '../../apps/web/src/lib/ui-theme-validator';

describe('Edge Middleware Standardization (SEC-MIDDLEWARE-EDGE)', () => {
  const middlewarePath = resolve(__dirname, '../../apps/web/src/middleware.ts');
  const proxyPath = resolve(__dirname, '../../apps/web/src/proxy.ts');

  it('verifies src/middleware.ts exists and src/proxy.ts is deprecated/removed @REQ: SEC-SESSION', () => {
    expect(existsSync(middlewarePath), 'apps/web/src/middleware.ts must exist for Next.js Edge Runtime').toBe(true);
    expect(existsSync(proxyPath), 'apps/web/src/proxy.ts should not exist').toBe(false);
  });

  it('ensures middleware exports middleware function and matcher config @REQ: SEC-SESSION', () => {
    expect(typeof middleware).toBe('function');
    expect(config).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
    // Sprawdzenie wykluczenia assetów statycznych z middleware
    const matcherPattern = config.matcher[0];
    expect(matcherPattern).toContain('_next/static');
    expect(matcherPattern).toContain('_next/image');
  });

  it('ensures RBAC routing strictly uses app_metadata role and denies forged roles @REQ: SEC-403-LOGGING', () => {
    // Role personelu i administratora kierowane są do dedykowanych paneli
    expect(resolveRoleDestination('org_admin')).toBe('/admin');
    expect(resolveRoleDestination('super_admin')).toBe('/admin');
    expect(resolveRoleDestination('nurse')).toBe('/staff');
    expect(resolveRoleDestination('family')).toBe('/dashboard');
    expect(resolveRoleDestination('legal_guardian')).toBe('/dashboard');

    // Niezdefiniowana lub sfałszowana rola ląduje w /login z błędem
    expect(resolveRoleDestination('hacker')).toBe('/login?error=unauthorized');
    expect(resolveRoleDestination(undefined)).toBe('/login?error=unauthorized');
  });
});
