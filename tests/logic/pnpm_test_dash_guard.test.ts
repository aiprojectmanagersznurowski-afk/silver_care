import { describe, it, expect } from 'vitest';
import { checkBash, kkConfig } from '../../tools/guard-core.mjs';

/**
 * @REQ: INFRA-EU-REGION
 * pnpm v10 przekazuje samodzielne `--` dosłownie do Playwrighta i Vitesta,
 * przez co filtr pliku i `--project` są ignorowane. Reguła bramki blokuje to w Bashu.
 */
describe('Reguła bramki zakazu separatora -- w komendach testowych (@REQ: INFRA-EU-REGION)', () => {
  const rule = kkConfig.forbiddenBashPatterns.find((p: { msg: string }) =>
    p.msg.includes('pnpm v10 przekazuje separator `--`'),
  );

  const BLOCKED_COMMANDS = [
    'pnpm test:e2e -- e2e/feature-flags.spec.ts --project=chromium',
    'lsof -nP -iTCP:3001 -sTCP:LISTEN 2>&1 || true; pnpm test:e2e -- e2e/feature-flags.spec.ts --project=chromium',
    'pnpm test:db -- tests/db/feature_flags.test.ts',
    'pnpm test -- tests/logic/auto_issue_automation.test.ts',
    'pnpm run test:e2e -- e2e/auth.spec.ts',
    'pnpm --filter web test -- foo.test.ts',
    'pnpm test:e2e --project=chromium -- e2e/feature-flags.spec.ts',
    'TEST_DB=true pnpm test:db -- tests/db/feature_flags.test.ts',
    'npx playwright test -- e2e/feature-flags.spec.ts --project=chromium',
    'pnpm exec playwright test -- e2e/feature-flags.spec.ts',
    './node_modules/.bin/playwright test -- e2e/feature-flags.spec.ts',
    'pnpm test:e2e --',
  ];

  const ALLOWED_COMMANDS = [
    'pnpm test --run',
    'pnpm test:e2e e2e/feature-flags.spec.ts --project=chromium',
    'pnpm test:db tests/db/feature_flags.test.ts',
    'pnpm test tests/logic/pnpm_test_dash_guard.test.ts',
    'pnpm exec playwright test e2e/feature-flags.spec.ts --project=chromium',
    'pnpm test:e2e e2e/feature-flags.spec.ts && git checkout -- e2e/feature-flags.spec.ts',
    'git commit -m "chore(infra): block pnpm test:e2e -- separator"',
    'grep -n "pnpm test:e2e --" AGENTS.md',
  ];

  it('@REQ: INFRA-EU-REGION - reguła istnieje w forbiddenBashPatterns', () => {
    expect(rule).toBeDefined();
  });

  it('@REQ: INFRA-EU-REGION - blokuje komendy testowe pnpm i playwright z separatorem --', () => {
    const ciRegex = new RegExp(rule!.re, 'i');
    for (const cmd of BLOCKED_COMMANDS) {
      const verdict = checkBash(cmd);
      expect(verdict.blocked, cmd).toBe(true);
      expect(verdict.reason, cmd).toContain('`--`');
      expect(ciRegex.test(cmd), cmd).toBe(true);
    }
  });

  it('@REQ: INFRA-EU-REGION - przepuszcza poprawne komendy bez separatora -- oraz niezwiązane użycia --', () => {
    const ciRegex = new RegExp(rule!.re, 'i');
    for (const cmd of ALLOWED_COMMANDS) {
      const verdict = checkBash(cmd);
      expect(verdict.blocked, cmd).toBe(false);
      expect(ciRegex.test(cmd), cmd).toBe(false);
    }
  });
});
