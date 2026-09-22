import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/lib/**', 'src/actions/**'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**'],
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
