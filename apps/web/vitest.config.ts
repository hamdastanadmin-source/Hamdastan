import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/features/**', 'src/lib/**'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**', 'src/**/index.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
      },
    },
    testTimeout: 15000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
