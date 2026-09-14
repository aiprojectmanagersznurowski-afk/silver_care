import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

const rootDir = import.meta.dirname || process.cwd();
dotenv.config({ path: path.resolve(rootDir, '.env.local') });

export default defineConfig({
  test: {
    testTimeout: 20000,
    include: process.env.DATABASE_URL
      ? ['tests/**/*.test.ts']
      : ['tests/logic/**/*.test.ts'],
  },
});
