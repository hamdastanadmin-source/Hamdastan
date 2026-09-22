import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/db/**/*.test.ts'],
    testTimeout: 30000,
    pool: 'forks',
    maxConcurrency: 1, // DB tests must run sequentially
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
