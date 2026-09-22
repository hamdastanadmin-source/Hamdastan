import { PrismaClient } from '@prisma/client';
import { beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';

// The prisma module is already mocked in setup.ts via vi.mock('@/lib/prisma')
// which creates a mockDeep proxy. We just re-export the typed instance here.

// Use a minimal type definition to avoid importing vitest-mock-extended at top level
// (its CJS entrypoint is incompatible with Vitest ESM mode)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MockPrismaClient = any;

export const prismaMock = prisma as unknown as MockPrismaClient;

/**
 * Call this in your test file to reset the Prisma mock between tests.
 * Usage:
 *   import { prismaMock, resetPrismaMock } from '../helpers/prisma-mock';
 *   resetPrismaMock();
 */
export function resetPrismaMock() {
  beforeEach(async () => {
    const { mockReset } = await import('vitest-mock-extended');
    mockReset(prismaMock);
  });
}
