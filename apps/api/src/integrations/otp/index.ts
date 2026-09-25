/**
 * Delivery of one-time codes — the outbound side of the auth module.
 *
 * `otpProvider()` is the only thing the service calls. Which adapter answers
 * is an environment decision, made here and nowhere else.
 */

import { env } from '../../config';

import { mockOtpProvider } from './mock-otp-provider';
import type { OtpProvider } from './otp-provider';

const providers: Record<typeof env.OTP_PROVIDER, () => OtpProvider> = {
  mock: () => mockOtpProvider,
};

/**
 * When a real gateway arrives: add its implementation beside
 * `mock-otp-provider.ts`, add it to the map above, and set `OTP_PROVIDER`.
 * Nothing in `modules/auth` changes.
 */
export function otpProvider(): OtpProvider {
  return providers[env.OTP_PROVIDER]();
}

export { OtpDeliveryError } from './otp-provider';
export type { OtpMessage, OtpProvider } from './otp-provider';
export { mockOtpProvider } from './mock-otp-provider';
