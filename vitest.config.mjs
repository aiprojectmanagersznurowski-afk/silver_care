import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

const rootDir = import.meta.dirname || process.cwd();
dotenv.config({ path: path.resolve(rootDir, '.env.local') });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'apps/web/src'),
      'next/server': path.resolve(rootDir, 'apps/web/node_modules/next/server.js'),
    },
  },
  test: {
    testTimeout: 20000,
    fileParallelism: process.env.TEST_DB === 'true' ? false : true,
    maxWorkers: process.env.TEST_DB === 'true' ? 1 : undefined,
    include: process.env.TEST_DB === 'true'
      ? ['tests/**/*.test.ts']
      : ['tests/logic/**/*.test.ts'],
  },
});
