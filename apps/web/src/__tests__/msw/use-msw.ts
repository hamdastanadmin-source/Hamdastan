import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './server';

/**
 * Call this at the top of a test file to enable MSW for that file.
 * MSW intercepts real HTTP calls instead of requiring vi.mock('axios').
 */
export function useMsw() {
  beforeAll(() => mswServer.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());
}
