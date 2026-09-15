import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Edge Middleware Standardization (SEC-MIDDLEWARE-EDGE)', () => {
  const middlewarePath = path.resolve(__dirname, '../../apps/web/src/middleware.ts');
  const proxyPath = path.resolve(__dirname, '../../apps/web/src/proxy.ts');

  it('verifies src/middleware.ts exists and src/proxy.ts is deprecated/removed @REQ: SEC-SESSION', () => {
    expect(fs.existsSync(middlewarePath), 'apps/web/src/middleware.ts must exist for Next.js Edge Runtime').toBe(true);
    expect(fs.existsSync(proxyPath), 'apps/web/src/proxy.ts should not exist').toBe(false);
  });

  it('ensures middleware exports middleware function and matcher config @REQ: SEC-SESSION', async () => {
    if (!fs.existsSync(middlewarePath)) {
      throw new Error('apps/web/src/middleware.ts not found');
    }
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    expect(content).toMatch(/export\s+(async\s+)?function\s+middleware/);
    expect(content).toMatch(/export\s+const\s+config\s*=\s*\{/);
    expect(content).toMatch(/matcher:/);
  });

  it('ensures updateSession does not authorize via user_metadata @REQ: SEC-403-LOGGING', () => {
    const sessionMiddlewarePath = path.resolve(__dirname, '../../apps/web/src/lib/supabase/middleware.ts');
    const content = fs.readFileSync(sessionMiddlewarePath, 'utf-8');
    expect(content).not.toMatch(/user_metadata\??\.role/);
    expect(content).toMatch(/app_metadata\??\.role/);
  });
});
