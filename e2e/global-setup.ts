import { execSync } from 'child_process';
import path from 'path';

/**
 * Global Setup dla Playwright E2E — upewnia się, że konta testowe istnieją.
 */
async function globalSetup() {
  const rootDir = path.resolve(__dirname, '..');
  execSync('node scripts/setup-e2e-users.mjs', {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

export default globalSetup;
