import { logger } from '@hamdastan/shared/logger';

import type { OtpMessage, OtpProvider } from './otp-provider';

/**
 * Stands in for the SMS gateway until one is contracted.
 *
 * Instead of sending anything it writes the code to the log and remembers the
 * last one per number, which is what lets the tests assert on a code they never
 * generated. It is not a fake user store and holds no auth state — the only
 * thing it knows is what it was handed to deliver.
 */
export type MockOtpProvider = OtpProvider & {
  /** The code most recently delivered to a number, if any. */
  lastCodeFor(phone: string): string | undefined;
  clear(): void;
};

function createMockOtpProvider(): MockOtpProvider {
  const lastCodeByPhone = new Map<string, string>();

  return {
    name: 'mock',

    async send(message: OtpMessage) {
      lastCodeByPhone.set(message.phone, message.code);

      logger.info(
        { phone: message.phone, code: message.code, provider: 'mock' },
        'one-time code not sent — no SMS gateway is wired up'
      );
    },

    lastCodeFor(phone) {
      return lastCodeByPhone.get(phone);
    },

    clear() {
      lastCodeByPhone.clear();
    },
  };
}

/**
 * The process-wide instance. Exported by name so a test can read the code it is
 * about to verify; application code reaches it through `otpProvider()` so that
 * swapping the adapter stays a one-line change.
 */
export const mockOtpProvider = createMockOtpProvider();
