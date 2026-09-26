/**
 * Sending a text message — the outbound side of both sign-in flows.
 *
 * `smsProvider()` is the only thing a service calls. Which adapter answers is
 * an environment decision, made here and nowhere else.
 */

import { env } from '../../config';

import { mockSmsProvider } from './mock-sms-provider';
import type { SmsProvider } from './sms-provider';

const providers: Record<typeof env.SMS_PROVIDER, () => SmsProvider> = {
  mock: () => mockSmsProvider,
};

/**
 * When a real gateway arrives: add its implementation beside
 * `mock-sms-provider.ts`, add it to the map above, and set `SMS_PROVIDER`.
 * Nothing in `modules/` changes — one adapter serves every message the product
 * sends.
 */
export function smsProvider(): SmsProvider {
  return providers[env.SMS_PROVIDER]();
}

export { SmsDeliveryError } from './sms-provider';
export type { SmsMessage, SmsProvider, SmsPurpose } from './sms-provider';
export { mockSmsProvider, type MockSmsProvider } from './mock-sms-provider';
