import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

/**
 * Only `TEST_DATABASE_URL` is taken from the root `.env`. Its `DATABASE_URL`
 * is deliberately not: that one is a real database, and the integration suite
 * resets the schema it runs against. `src/__tests__/setup.ts` points the API
 * at the test database before anything reads the environment.
 */
const fileEnv = loadEnv('test', repoRoot, '');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? '',
    },
    // One database, one schema: suites that reset it cannot run side by side.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
