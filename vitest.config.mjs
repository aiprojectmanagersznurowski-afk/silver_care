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
    include: process.env.DATABASE_URL
      ? ['tests/**/*.test.ts']
      : ['tests/logic/**/*.test.ts'],
  },
});
