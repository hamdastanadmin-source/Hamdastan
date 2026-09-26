import { logger } from '@hamdastan/shared/logger';

import type { SmsMessage, SmsProvider } from './sms-provider';

/**
 * Stands in for the SMS gateway until one is contracted.
 *
 * Instead of sending anything it writes the message to the log and keeps it in
 * an outbox, which is what lets the tests assert on a code or a temporary
 * password they never generated. It holds no auth state of any kind — the only
 * thing it knows is what it was handed to deliver.
 *
 * The outbox is a development affordance. It is in memory, it is capped, and it
 * dies with the process; nothing in the product reads it.
 */
export type MockSmsProvider = SmsProvider & {
  /** The message most recently delivered to a number, if any. */
  lastMessageFor(phone: string): SmsMessage | undefined;
  /** Everything still in the outbox, oldest first. */
  outbox(): readonly SmsMessage[];
  clear(): void;
};

/** Enough to inspect a flow, few enough that the array cannot grow unbounded. */
const OUTBOX_LIMIT = 50;

function createMockSmsProvider(): MockSmsProvider {
  const sent: SmsMessage[] = [];

  return {
    name: 'mock',

    async send(message: SmsMessage) {
      sent.push(message);
      if (sent.length > OUTBOX_LIMIT) sent.shift();

      logger.info(
        { phone: message.phone, purpose: message.purpose, text: message.text, provider: 'mock' },
        'SMS not sent — no gateway is wired up'
      );
    },

    lastMessageFor(phone) {
      for (let index = sent.length - 1; index >= 0; index -= 1) {
        if (sent[index].phone === phone) return sent[index];
      }
      return undefined;
    },

    outbox() {
      return sent;
    },

    clear() {
      sent.length = 0;
    },
  };
}

/**
 * The process-wide instance. Exported by name so a test can read the message it
 * is about to act on; application code reaches it through `smsProvider()` so
 * that swapping the adapter stays a one-line change.
 */
export const mockSmsProvider = createMockSmsProvider();
