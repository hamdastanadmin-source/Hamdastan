import { OTP_CODE_LENGTH } from '@hamdastan/validation';

import { mockSmsProvider } from '../../../integrations/sms';

/**
 * Shared by the service and controller tests, so the fixture data cannot drift
 * between them — `PROFILE` mirrors `registerSchema`, and a change to that shape
 * should break both suites at once.
 */

export const PHONE = '09123456789';

/** A code of the right shape that is never the right code. */
export const WRONG_CODE = '0'.repeat(OTP_CODE_LENGTH);
export const OTHER_PHONE = '09350000000';

export const PROFILE = {
  firstName: 'امید',
  lastName: 'بهشتی',
  birthDate: '1990-05-20',
  gender: 'MALE',
} as const;

/**
 * The code the backend just delivered — read out of the mock gateway's outbox,
 * which is the one thing in these tests a real client could not do.
 *
 * The message is composed by `integrations/otp/sms-otp-provider.ts` and the
 * code is the only run of digits of that length in it, so pulling it back out
 * needs no template parsing.
 */
export function sentCode(phone: string = PHONE): string {
  const message = mockSmsProvider.lastMessageFor(phone);
  const code = message?.text.match(new RegExp(`\\d{${OTP_CODE_LENGTH}}`))?.[0];
  if (!code) throw new Error(`no code was delivered to ${phone}`);
  return code;
}
