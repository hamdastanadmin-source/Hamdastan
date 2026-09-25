import { OTP_CODE_LENGTH } from '@hamdastan/validation';

import { mockOtpProvider } from '../../../integrations/otp';

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
 * The code the backend just delivered — read from the mock gateway's memory,
 * which is the one thing in these tests a real client could not do.
 */
export function sentCode(phone: string = PHONE): string {
  const code = mockOtpProvider.lastCodeFor(phone);
  if (!code) throw new Error(`no code was delivered to ${phone}`);
  return code;
}
